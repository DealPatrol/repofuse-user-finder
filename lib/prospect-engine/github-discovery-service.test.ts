import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discoverGithubProspects, getProspectByIdOrUsername } from './github-discovery-service'
import { getMockProspects, getMockProspectById } from './prospect-repository'
import type { GithubDiscoveryInput } from './types'

function jsonResponse(body: unknown, init: { status?: number; rateLimitRemaining?: string | null } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-ratelimit-remaining' ? init.rateLimitRemaining ?? null : null),
    },
    json: async () => body,
  } as unknown as Response
}

function makeGitHubProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    login: 'alice',
    name: 'Alice Dev',
    html_url: 'https://github.com/alice',
    email: null,
    blog: null,
    location: null,
    bio: 'Building a SaaS dashboard',
    public_repos: 20,
    followers: 100,
    following: 10,
    ...overrides,
  }
}

function makeGitHubRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'saas-app',
    html_url: 'https://github.com/alice/saas-app',
    description: 'A SaaS dashboard',
    stargazers_count: 5,
    forks_count: 1,
    language: 'TypeScript',
    pushed_at: new Date().toISOString(),
    topics: [],
    ...overrides,
  }
}

function baseInput(overrides: Partial<GithubDiscoveryInput> = {}): GithubDiscoveryInput {
  return {
    minimumRepos: 0,
    keywords: ['saas'],
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubEnv('GITHUB_TOKEN', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('discoverGithubProspects', () => {
  it('returns mock prospects and a mock message when GITHUB_TOKEN is not set', async () => {
    const input = baseInput({ limit: 2 })
    const result = await discoverGithubProspects(input)

    expect(result.mode).toBe('mock')
    expect(result.message).toBe('Mock mode: set GITHUB_TOKEN to run live GitHub discovery.')
    expect(result.prospects).toEqual(getMockProspects(2))
    expect(result.rateLimitRemaining).toBeNull()
  })

  it('builds a search query reflecting all provided filters', async () => {
    const result = await discoverGithubProspects(
      baseInput({
        minimumRepos: 3,
        minimumFollowers: 100,
        language: 'TypeScript',
        location: 'Austin',
        keywords: ['saas', 'ai'],
      }),
    )

    expect(result.query).toContain('type:user')
    expect(result.query).toContain('repos:>=3')
    expect(result.query).toContain('followers:>=100')
    expect(result.query).toContain('language:TypeScript')
    expect(result.query).toContain('location:Austin')
    expect(result.query).toContain('saas ai in:bio')
  })

  it('fetches live results, maps profiles/repos, and sorts by totalScore descending', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/search/users')) {
        return jsonResponse({ items: [{ login: 'low-scorer' }, { login: 'high-scorer' }] }, { rateLimitRemaining: '58' })
      }
      if (url.includes('/users/low-scorer/repos')) {
        return jsonResponse([])
      }
      if (url.includes('/users/low-scorer')) {
        return jsonResponse(makeGitHubProfile({ login: 'low-scorer', public_repos: 1, followers: 1, bio: null }))
      }
      if (url.includes('/users/high-scorer/repos')) {
        return jsonResponse([makeGitHubRepo({ name: 'ai-saas-app', description: 'ai saas tool', topics: ['saas'] })])
      }
      if (url.includes('/users/high-scorer')) {
        return jsonResponse(
          makeGitHubProfile({
            login: 'high-scorer',
            name: 'High Scorer',
            public_repos: 40,
            followers: 5000,
            email: 'high@example.com',
            bio: 'Product Hunt launcher, building in public',
          }),
        )
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverGithubProspects(baseInput({ minimumRepos: 0, limit: 10 }))

    expect(result.mode).toBe('live')
    expect(result.message).toBe('Live GitHub discovery completed.')
    expect(result.prospects).toHaveLength(2)
    expect(result.prospects[0].githubUsername).toBe('high-scorer')
    expect(result.prospects[0].totalScore).toBeGreaterThanOrEqual(result.prospects[1].totalScore)
    expect(result.prospects[0].email).toBe('high@example.com')
    expect(result.rateLimitRemaining).not.toBeNull()
  })

  it('filters out profiles below minimumRepos without fetching their repos', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token')

    const repoFetchSpy = vi.fn()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/search/users')) {
        return jsonResponse({ items: [{ login: 'sparse-user' }] })
      }
      if (url.includes('/users/sparse-user/repos')) {
        repoFetchSpy()
        return jsonResponse([])
      }
      if (url.includes('/users/sparse-user')) {
        return jsonResponse(makeGitHubProfile({ login: 'sparse-user', public_repos: 1 }))
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverGithubProspects(baseInput({ minimumRepos: 10 }))

    expect(result.prospects).toHaveLength(0)
    expect(result.message).toBe('Live GitHub discovery completed, but no prospects matched the filters.')
    expect(repoFetchSpy).not.toHaveBeenCalled()
  })

  it('filters out profiles below minimumFollowers', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/search/users')) {
        return jsonResponse({ items: [{ login: 'low-followers' }] })
      }
      if (url.includes('/users/low-followers')) {
        return jsonResponse(makeGitHubProfile({ login: 'low-followers', public_repos: 5, followers: 2 }))
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverGithubProspects(baseInput({ minimumRepos: 0, minimumFollowers: 50 }))

    expect(result.prospects).toHaveLength(0)
  })

  it('falls back to mock prospects when the GitHub API call fails', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Bad credentials' }, { status: 401 })),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await discoverGithubProspects(baseInput())

    expect(result.mode).toBe('mock')
    expect(result.message).toBe('GitHub discovery failed, so the prototype is showing mock prospects instead.')
    expect(result.prospects.length).toBeGreaterThan(0)
  })
})

describe('getProspectByIdOrUsername', () => {
  it('returns a built-in mock prospect without hitting the network when the id matches', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const mockProspect = getMockProspectById('maya-builds')
    const result = await getProspectByIdOrUsername('maya-builds')

    expect(result.mode).toBe('mock')
    expect(result.message).toBe('Showing a built-in sample prospect.')
    expect(result.prospect).toEqual(mockProspect)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null with a setup message when there is no mock match and no token', async () => {
    const result = await getProspectByIdOrUsername('some-real-github-user')

    expect(result.prospect).toBeNull()
    expect(result.mode).toBe('mock')
    expect(result.message).toBe('Set GITHUB_TOKEN to load live GitHub prospect details.')
  })

  it('loads and maps a live GitHub profile when a token is configured', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/repos')) {
        return jsonResponse([makeGitHubRepo()])
      }
      return jsonResponse(makeGitHubProfile({ login: 'real-user' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getProspectByIdOrUsername('real-user')

    expect(result.mode).toBe('live')
    expect(result.message).toBe('Loaded live GitHub prospect details.')
    expect(result.prospect?.githubUsername).toBe('real-user')
  })

  it('returns null with a failure message when the live lookup fails', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Not Found' }, { status: 404 })),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await getProspectByIdOrUsername('missing-user')

    expect(result.prospect).toBeNull()
    expect(result.mode).toBe('mock')
    expect(result.message).toBe('Could not load that GitHub prospect.')
  })
})
