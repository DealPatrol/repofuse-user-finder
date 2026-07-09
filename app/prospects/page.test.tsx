// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getMockProspects } from '@/lib/prospect-engine/prospect-repository'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: 'test-user', email: 'test@example.com' } }),
    },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import ProspectsPage from './page'

describe('ProspectsPage', () => {
  it('renders the hero heading and discovery call-to-action', async () => {
    const jsx = await ProspectsPage()
    render(jsx)

    expect(screen.getByRole('heading', { name: 'RepoFuse Prospect Engine' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /run discovery/i })).toHaveAttribute('href', '/prospects/discover')
  })

  it('renders all three workflow steps', async () => {
    const jsx = await ProspectsPage()
    render(jsx)

    expect(screen.getAllByText('Discover').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Score').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Review').length).toBeGreaterThan(0)
  })

  it('renders the sample prospect table populated with mock prospects', async () => {
    const jsx = await ProspectsPage()
    render(jsx)

    const [firstMockProspect] = getMockProspects()
    expect(screen.getByRole('heading', { name: 'Sample prospect queue' })).toBeInTheDocument()
    expect(screen.getByText(firstMockProspect.name)).toBeInTheDocument()
  })
})
