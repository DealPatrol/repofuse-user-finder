// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ProspectTable } from './prospect-table'
import type { Prospect } from '@/lib/prospect-engine/types'

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
    repoCount: 12,
    followers: 3400,
    following: 20,
    recentActivityScore: 15,
    keywordScore: 10,
    productHuntScore: 0,
    buildInPublicScore: 0,
    publicEmailScore: 0,
    totalScore: 60,
    status: 'new',
    notes: null,
    repos: [],
    scoreReasons: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ProspectTable', () => {
  it('renders an empty state when there are no prospects', () => {
    render(<ProspectTable prospects={[]} />)
    expect(screen.getByText('No prospects matched these filters.')).toBeInTheDocument()
  })

  it('renders a row per prospect with key fields', () => {
    const prospect = makeProspect({ email: 'jane@example.com', repoCount: 12, followers: 3400 })
    render(<ProspectTable prospects={[prospect]} />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('@octocat')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3,400')).toBeInTheDocument()
  })

  it('falls back to "Not public" when the prospect has no email', () => {
    render(<ProspectTable prospects={[makeProspect({ email: null })]} />)
    expect(screen.getByText('Not public')).toBeInTheDocument()
  })

  it('links the prospect name to its GitHub profile and the review action to the detail page', () => {
    render(<ProspectTable prospects={[makeProspect({ id: 'jane-doe', githubUrl: 'https://github.com/octocat' })]} />)

    expect(screen.getByRole('link', { name: /@octocat/ })).toHaveAttribute('href', 'https://github.com/octocat')
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/prospects/jane-doe')
  })

  it('renders the prospect status as a capitalized badge', () => {
    render(<ProspectTable prospects={[makeProspect({ status: 'contacted' })]} />)
    expect(screen.getByText('contacted')).toBeInTheDocument()
  })

  it('applies the emerald score tone for scores 75 and above', () => {
    render(<ProspectTable prospects={[makeProspect({ totalScore: 80 })]} />)
    expect(screen.getByText('80')).toHaveClass('text-emerald-300')
  })

  it('applies the amber score tone for scores between 55 and 74', () => {
    render(<ProspectTable prospects={[makeProspect({ totalScore: 60 })]} />)
    expect(screen.getByText('60')).toHaveClass('text-amber-300')
  })

  it('applies the slate score tone for scores below 55', () => {
    render(<ProspectTable prospects={[makeProspect({ totalScore: 30 })]} />)
    expect(screen.getByText('30')).toHaveClass('text-slate-300')
  })

  it('renders one row per prospect in a multi-row table', () => {
    render(
      <ProspectTable
        prospects={[makeProspect({ id: 'a', name: 'Prospect A' }), makeProspect({ id: 'b', name: 'Prospect B' })]}
      />,
    )

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // header row + 2 data rows
    expect(rows).toHaveLength(3)
    expect(screen.getByText('Prospect A')).toBeInTheDocument()
    expect(screen.getByText('Prospect B')).toBeInTheDocument()
  })
})
