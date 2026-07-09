import { describe, expect, it } from 'vitest'
import { DEFAULT_PROSPECT_KEYWORDS, findMatchedKeywords, normalizeKeywords, scoreLead } from './lead-scoring-service'
import type { ProspectRepo } from './types'

function makeRepo(overrides: Partial<ProspectRepo> = {}): ProspectRepo {
  return {
    id: '1',
    name: 'my-saas-app',
    url: 'https://github.com/user/my-saas-app',
    description: 'A SaaS dashboard',
    stars: 10,
    forks: 2,
    language: 'TypeScript',
    pushedAt: new Date().toISOString(),
    matchedKeywords: [],
    ...overrides,
  }
}

describe('normalizeKeywords', () => {
  it('lowercases, trims, and dedupes keywords', () => {
    expect(normalizeKeywords([' SaaS ', 'saas', 'AI'])).toEqual(['saas', 'ai'])
  })

  it('splits comma-separated keywords within a single entry', () => {
    expect(normalizeKeywords(['saas, ai , crm'])).toEqual(['saas', 'ai', 'crm'])
  })

  it('drops empty entries produced by splitting', () => {
    expect(normalizeKeywords(['saas,, ai,'])).toEqual(['saas', 'ai'])
  })

  it('falls back to the default keyword list when input is empty', () => {
    expect(normalizeKeywords([])).toEqual(DEFAULT_PROSPECT_KEYWORDS)
  })

  it('falls back to the default keyword list when input normalizes to nothing', () => {
    expect(normalizeKeywords([' ', ',,'])).toEqual(DEFAULT_PROSPECT_KEYWORDS)
  })
})

describe('findMatchedKeywords', () => {
  it('matches keywords found in the repo name, description, or language', () => {
    const repo = makeRepo({ name: 'crm-tool', description: 'automation for founders', language: 'Go' })
    expect(findMatchedKeywords(repo, ['crm', 'automation', 'go', 'missing'])).toEqual(['crm', 'automation', 'go'])
  })

  it('is case-insensitive', () => {
    const repo = makeRepo({ name: 'MyCRM', description: null, language: null })
    expect(findMatchedKeywords(repo, ['crm'])).toEqual(['crm'])
  })

  it('handles null description and language without throwing', () => {
    const repo = makeRepo({ name: 'plain-repo', description: null, language: null })
    expect(findMatchedKeywords(repo, ['saas'])).toEqual([])
  })

  it('returns no matches when nothing overlaps', () => {
    const repo = makeRepo({ name: 'unrelated', description: 'nothing here', language: 'Python' })
    expect(findMatchedKeywords(repo, ['saas', 'crm'])).toEqual([])
  })
})

describe('scoreLead', () => {
  const keywords = ['saas', 'ai']

  it('scores a minimal profile with zero repos and zero followers at the floor', () => {
    const score = scoreLead({ bio: null, website: null, email: null, repoCount: 0, followers: 0 }, [], keywords)

    expect(score.repoCountScore).toBe(0)
    expect(score.recentActivityScore).toBe(0)
    expect(score.keywordScore).toBe(0)
    expect(score.publicEmailScore).toBe(0)
    expect(score.followersScore).toBe(0)
    expect(score.productHuntScore).toBe(0)
    expect(score.buildInPublicScore).toBe(0)
    expect(score.totalScore).toBe(0)
    expect(score.reasons).toEqual([])
  })

  it('does not throw or return NaN when followers is 0 (log10 guard)', () => {
    const score = scoreLead({ bio: null, website: null, email: null, repoCount: 1, followers: 0 }, [], keywords)
    expect(Number.isFinite(score.followersScore)).toBe(true)
    expect(score.followersScore).toBe(0)
  })

  it('awards the public email bonus only when an email is present', () => {
    const withEmail = scoreLead(
      { bio: null, website: null, email: 'dev@example.com', repoCount: 0, followers: 0 },
      [],
      keywords,
    )
    const withoutEmail = scoreLead({ bio: null, website: null, email: null, repoCount: 0, followers: 0 }, [], keywords)

    expect(withEmail.publicEmailScore).toBe(8)
    expect(withoutEmail.publicEmailScore).toBe(0)
    expect(withEmail.reasons).toContain('Public email is available for compliant manual outreach.')
  })

  it('clamps totalScore at 100 even when every component is maxed out', () => {
    const manyKeywords = ['saas', 'ai', 'crm', 'dashboard', 'automation', 'startup']
    const manyRepos: ProspectRepo[] = Array.from({ length: 40 }, (_, i) =>
      makeRepo({
        id: String(i),
        name: `${manyKeywords.join('-')}-repo-${i}`,
        pushedAt: new Date().toISOString(),
      }),
    )
    const score = scoreLead(
      { bio: 'product hunt launch, building in public', website: null, email: 'dev@example.com', repoCount: 500, followers: 1_000_000 },
      manyRepos,
      manyKeywords,
    )

    expect(score.totalScore).toBe(100)
    expect(score.totalScore).toBeLessThanOrEqual(100)
  })

  it('ignores repos with missing or invalid pushedAt when scoring recent activity', () => {
    const repos = [
      makeRepo({ id: '1', pushedAt: null }),
      makeRepo({ id: '2', pushedAt: 'not-a-date' }),
    ]
    const score = scoreLead({ bio: null, website: null, email: null, repoCount: 2, followers: 0 }, repos, keywords)
    expect(score.recentActivityScore).toBe(0)
  })

  it('counts recently and very recently pushed repos toward recentActivityScore', () => {
    const now = Date.now()
    const repos = [
      makeRepo({ id: '1', pushedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() }), // very recent + recent
      makeRepo({ id: '2', pushedAt: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString() }), // recent only
      makeRepo({ id: '3', pushedAt: new Date(now - 400 * 24 * 60 * 60 * 1000).toISOString() }), // neither
    ]
    const score = scoreLead({ bio: null, website: null, email: null, repoCount: 3, followers: 0 }, repos, keywords)
    // recentlyTouched=2 (*3=6), veryRecent=1 (*2=2) => 8
    expect(score.recentActivityScore).toBe(8)
  })

  it('deduplicates matched keywords across repo-derived matches and pre-tagged matchedKeywords', () => {
    const repos = [
      makeRepo({ id: '1', name: 'saas-app', description: null, language: null, matchedKeywords: ['SAAS', 'ai'] }),
    ]
    const score = scoreLead({ bio: null, website: null, email: null, repoCount: 1, followers: 0 }, repos, keywords)
    // unique keywords: saas, ai => 2 * 4 = 8
    expect(score.keywordScore).toBe(8)
  })

  it('detects Product Hunt signal in bio or repo descriptions', () => {
    const inBio = scoreLead({ bio: 'Featured on Product Hunt', website: null, email: null, repoCount: 0, followers: 0 }, [], keywords)
    const inRepo = scoreLead(
      { bio: null, website: null, email: null, repoCount: 1, followers: 0 },
      [makeRepo({ description: 'launched on producthunt' })],
      keywords,
    )
    const neither = scoreLead({ bio: 'just a dev', website: null, email: null, repoCount: 0, followers: 0 }, [], keywords)

    expect(inBio.productHuntScore).toBe(7)
    expect(inRepo.productHuntScore).toBe(7)
    expect(neither.productHuntScore).toBe(0)
  })

  it('detects build-in-public / maker language in profile text', () => {
    const score = scoreLead({ bio: 'indie hacker building in public', website: null, email: null, repoCount: 0, followers: 0 }, [], keywords)
    expect(score.buildInPublicScore).toBe(7)
    expect(score.reasons).toContain('Build-in-public or maker language appears in their public profile.')
  })

  it('includes a repo-count reason only once repoCount reaches 10', () => {
    const below = scoreLead({ bio: null, website: null, email: null, repoCount: 9, followers: 0 }, [], keywords)
    const atThreshold = scoreLead({ bio: null, website: null, email: null, repoCount: 10, followers: 0 }, [], keywords)

    expect(below.reasons.some((r) => r.includes('public repos'))).toBe(false)
    expect(atThreshold.reasons.some((r) => r.includes('public repos'))).toBe(true)
  })

  it('lists at most 5 matched keywords in the keyword reason', () => {
    const manyKeywords = ['saas', 'ai', 'crm', 'dashboard', 'automation', 'startup']
    const repos = [makeRepo({ name: manyKeywords.join(' '), description: null, language: null })]
    const score = scoreLead({ bio: null, website: null, email: null, repoCount: 1, followers: 0 }, repos, manyKeywords)

    const keywordReason = score.reasons.find((r) => r.startsWith('Matched RepoFuse-friendly keywords'))
    expect(keywordReason).toBeDefined()
    const listedKeywords = keywordReason!.replace('Matched RepoFuse-friendly keywords: ', '').replace('.', '').split(', ')
    expect(listedKeywords.length).toBeLessThanOrEqual(5)
  })
})
