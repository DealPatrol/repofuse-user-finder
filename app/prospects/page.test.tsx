// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProspectsPage from './page'
import { getMockProspects } from '@/lib/prospect-engine/prospect-repository'

describe('ProspectsPage', () => {
  it('renders the hero heading and discovery call-to-action', () => {
    render(<ProspectsPage />)

    expect(screen.getByRole('heading', { name: 'RepoFuse Prospect Engine' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /run discovery/i })).toHaveAttribute('href', '/prospects/discover')
  })

  it('renders all three workflow steps', () => {
    render(<ProspectsPage />)

    expect(screen.getByText('Discover', { selector: '.font-semibold' })).toBeInTheDocument()
    expect(screen.getByText('Score', { selector: '.font-semibold' })).toBeInTheDocument()
    expect(screen.getByText('Review', { selector: '.font-semibold' })).toBeInTheDocument()
  })

  it('renders the sample prospect table populated with mock prospects', () => {
    render(<ProspectsPage />)

    const [firstMockProspect] = getMockProspects()
    expect(screen.getByRole('heading', { name: 'Sample prospect queue' })).toBeInTheDocument()
    expect(screen.getByText(firstMockProspect.name)).toBeInTheDocument()
  })
})
