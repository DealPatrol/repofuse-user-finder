// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Prospect } from '@/lib/prospect-engine/types'

vi.mock('@/lib/prospect-engine/github-discovery-service', () => ({
  getProspectByIdOrUsername: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

import { getProspectByIdOrUsername } from '@/lib/prospect-engine/github-discovery-service'
import { notFound } from 'next/navigation'
import ProspectDetailPage from './page'

function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: 'octocat',
    name: 'Jane Doe',
    githubUsername: 'octocat',
    githubUrl: 'https://github.com/octocat',
    email: 'jane@example.com',
    website: null,
    location: 'Austin, TX',
    bio: 'Building SaaS tools',
    repoCount: 12,
    followers: 3400,
    following: 20,
    recentActivityScore: 15,
    keywordScore: 10,
    productHuntScore: 0,
    buildInPublicScore: 0,
    publicEmailScore: 8,
    totalScore: 60,
    status: 'new',
    notes: null,
    repos: [
      {
        id: 'repo-1',
        name: 'saas-app',
        url: 'https://github.com/octocat/saas-app',
        description: 'A SaaS dashboard',
        stars: 42,
        forks: 5,
        language: 'TypeScript',
        pushedAt: new Date().toISOString(),
        matchedKeywords: ['saas'],
      },
    ],
    scoreReasons: ['Public email is available for compliant manual outreach.'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

afterEach(() => {
  vi.mocked(getProspectByIdOrUsername).mockReset()
  vi.mocked(notFound).mockClear()
})

describe('ProspectDetailPage', () => {
  it('calls notFound when no prospect is found', async () => {
    vi.mocked(getProspectByIdOrUsername).mockResolvedValue({
      prospect: null,
      mode: 'mock',
      message: 'Could not load that GitHub prospect.',
    })

    await expect(ProspectDetailPage({ params: Promise.resolve({ id: 'missing-user' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('renders prospect details, score reasons, contact info, repos, and the outreach draft', async () => {
    vi.mocked(getProspectByIdOrUsername).mockResolvedValue({
      prospect: makeProspect(),
      mode: 'live',
      message: 'Loaded live GitHub prospect details.',
    })

    const jsx = await ProspectDetailPage({ params: Promise.resolve({ id: 'octocat' }) })
    render(jsx)

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument()
    expect(screen.getByText('Loaded live GitHub prospect details.')).toBeInTheDocument()
    expect(screen.getByText('Live GitHub')).toBeInTheDocument()

    expect(screen.getByText('60')).toBeInTheDocument() // total score
    expect(screen.getByText('12')).toBeInTheDocument() // repo count
    expect(screen.getByText('3,400')).toBeInTheDocument() // followers

    expect(screen.getByText('Public email is available for compliant manual outreach.')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Austin, TX')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /saas-app/ })).toHaveAttribute('href', 'https://github.com/octocat/saas-app')
    expect(screen.getByText('A SaaS dashboard')).toBeInTheDocument()
    expect(screen.getByText('42 stars')).toBeInTheDocument()

    expect(screen.getByText('Quick idea from your GitHub projects')).toBeInTheDocument()
    expect(screen.getByText(/I came across your GitHub/)).toBeInTheDocument()

    // ReviewPanel is wired up with the prospect's status and generated outreach.
    expect(screen.getByRole('button', { name: /approve draft/i })).toBeInTheDocument()
  })

  it('shows the "Sample" badge and fallback copy for mock-mode prospects with missing bio/location', async () => {
    vi.mocked(getProspectByIdOrUsername).mockResolvedValue({
      prospect: makeProspect({ bio: null, location: null, email: null, scoreReasons: [] }),
      mode: 'mock',
      message: 'Showing a built-in sample prospect.',
    })

    const jsx = await ProspectDetailPage({ params: Promise.resolve({ id: 'octocat' }) })
    render(jsx)

    expect(screen.getByText('Sample')).toBeInTheDocument()
    expect(screen.getByText('No public bio available.')).toBeInTheDocument()
    expect(screen.getByText('No public location')).toBeInTheDocument()
    expect(screen.getByText('No public email found')).toBeInTheDocument()
    expect(screen.getByText('No strong scoring reasons were detected yet.')).toBeInTheDocument()
  })
})
