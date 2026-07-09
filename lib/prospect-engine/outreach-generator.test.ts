import { describe, expect, it } from 'vitest'
import { generateOutreachMessage } from './outreach-generator'
import type { Prospect, ProspectRepo } from './types'

function makeRepo(overrides: Partial<ProspectRepo> = {}): ProspectRepo {
  return {
    id: '1',
    name: 'repo-one',
    url: 'https://github.com/user/repo-one',
    description: null,
    stars: 0,
    forks: 0,
    language: null,
    pushedAt: null,
    matchedKeywords: [],
    ...overrides,
  }
}

function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: 'octocat',
    name: 'Jane Doe',
    githubUsername: 'octocat',
    githubUrl: 'https://github.com/octocat',
    email: null,
    website: null,
    location: null,
    bio: null,
    repoCount: 0,
    followers: 0,
    following: 0,
    recentActivityScore: 0,
    keywordScore: 0,
    productHuntScore: 0,
    buildInPublicScore: 0,
    publicEmailScore: 0,
    totalScore: 0,
    status: 'new',
    notes: null,
    repos: [],
    scoreReasons: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('generateOutreachMessage', () => {
  it('uses email channel when the prospect has an email, manual otherwise', () => {
    expect(generateOutreachMessage(makeProspect({ email: 'jane@example.com' })).channel).toBe('email')
    expect(generateOutreachMessage(makeProspect({ email: null })).channel).toBe('manual')
  })

  it('uses the first name for the greeting', () => {
    const message = generateOutreachMessage(makeProspect({ name: 'Jane Doe' }))
    expect(message.body).toContain('Hey Jane,')
  })

  it('falls back to the GitHub username when name is empty', () => {
    const message = generateOutreachMessage(makeProspect({ name: '', githubUsername: 'octocat' }))
    expect(message.body).toContain('Hey octocat,')
  })

  it('falls back to generic project language when the prospect has no repos', () => {
    const message = generateOutreachMessage(makeProspect({ repos: [] }))
    expect(message.body).toContain('your GitHub projects')
    expect(message.body).toContain('launchable developer products')
  })

  it('picks the repo with the most matched keywords, breaking ties by stars', () => {
    const repos = [
      makeRepo({ id: '1', name: 'low-match', matchedKeywords: ['saas'], stars: 100 }),
      makeRepo({ id: '2', name: 'high-match', matchedKeywords: ['saas', 'ai'], stars: 5 }),
    ]
    const message = generateOutreachMessage(makeProspect({ repos }))
    expect(message.body).toContain('high-match')
  })

  it('breaks matched-keyword ties using star count', () => {
    const repos = [
      makeRepo({ id: '1', name: 'fewer-stars', matchedKeywords: ['saas'], stars: 1 }),
      makeRepo({ id: '2', name: 'more-stars', matchedKeywords: ['saas'], stars: 50 }),
    ]
    const message = generateOutreachMessage(makeProspect({ repos }))
    expect(message.body).toContain('more-stars')
  })

  it('includes the repo description in parentheses when present', () => {
    const repos = [makeRepo({ name: 'my-repo', description: 'a cool tool', matchedKeywords: ['saas'] })]
    const message = generateOutreachMessage(makeProspect({ repos }))
    expect(message.body).toContain('my-repo (a cool tool)')
  })

  it('omits the parenthetical when the repo has no description', () => {
    const repos = [makeRepo({ name: 'my-repo', description: null, matchedKeywords: ['saas'] })]
    const message = generateOutreachMessage(makeProspect({ repos }))
    expect(message.body).toContain('my-repo.')
    expect(message.body).not.toContain('my-repo (')
  })

  it('joins up to 3 distinct matched keywords across all repos as the theme', () => {
    const repos = [
      makeRepo({ id: '1', matchedKeywords: ['saas', 'ai'] }),
      makeRepo({ id: '2', matchedKeywords: ['ai', 'crm', 'dashboard'] }),
    ]
    const message = generateOutreachMessage(makeProspect({ repos }))
    // unique keywords in insertion order: saas, ai, crm (dashboard excluded, only 3 kept)
    expect(message.body).toContain('saas, ai, crm')
  })

  it('always includes a fixed subject and draft status', () => {
    const message = generateOutreachMessage(makeProspect())
    expect(message.subject).toBe('Quick idea from your GitHub projects')
    expect(message.status).toBe('draft')
  })
})
