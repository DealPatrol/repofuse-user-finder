// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ReviewPanel } from './review-panel'

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  // @ts-expect-error - cleanup the test-only stub between tests
  delete navigator.clipboard
})

describe('ReviewPanel', () => {
  it('renders the initial status', () => {
    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body text" />)
    expect(screen.getByText('new')).toBeInTheDocument()
  })

  it('sets status to approved when "Approve draft" is clicked', () => {
    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body text" />)
    fireEvent.click(screen.getByRole('button', { name: /approve draft/i }))
    expect(screen.getByText('approved')).toBeInTheDocument()
  })

  it('sets status to contacted when "Mark contacted" is clicked', () => {
    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body text" />)
    fireEvent.click(screen.getByRole('button', { name: /mark contacted/i }))
    expect(screen.getByText('contacted')).toBeInTheDocument()
  })

  it('sets status to rejected when "Reject" is clicked', () => {
    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body text" />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(screen.getByText('rejected')).toBeInTheDocument()
  })

  it('copies the subject and body to the clipboard and shows temporary confirmation', async () => {
    vi.useFakeTimers()
    const writeText = stubClipboard()

    render(<ReviewPanel initialStatus="new" subject="Quick idea" body="Body text" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy message/i }))
    })

    expect(writeText).toHaveBeenCalledWith('Subject: Quick idea\n\nBody text')
    expect(screen.getByRole('button', { name: /^copied$/i })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1800)
    })

    expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument()
  })

  it('does not throw when the Clipboard API is unavailable', async () => {
    render(<ReviewPanel initialStatus="new" subject="Quick idea" body="Body text" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy message/i }))
    })

    expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument()
  })

  it('hides the auto-send button when autoSendEnabled is false', () => {
    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body" autoSendEnabled={false} onAutoSend={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /auto-send to twitter/i })).not.toBeInTheDocument()
    expect(screen.getByText(/use copy message to manually reach out/i)).toBeInTheDocument()
  })

  it('hides the auto-send button when no onAutoSend handler is provided', () => {
    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body" autoSendEnabled />)
    expect(screen.queryByRole('button', { name: /auto-send to twitter/i })).not.toBeInTheDocument()
  })

  it('calls onAutoSend, shows a sending indicator, and marks the prospect contacted on success', async () => {
    let resolveSend: () => void = () => {}
    const onAutoSend = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve
        }),
    )

    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body text" autoSendEnabled onAutoSend={onAutoSend} />)

    fireEvent.click(screen.getByRole('button', { name: /auto-send to twitter/i }))

    expect(await screen.findByRole('button', { name: /sending/i })).toBeInTheDocument()
    expect(onAutoSend).toHaveBeenCalledWith('Body text')

    await act(async () => {
      resolveSend()
    })

    expect(screen.getByText('contacted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auto-send to twitter/i })).toBeInTheDocument()
  })

  it('logs and resets sending state without changing status when onAutoSend rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onAutoSend = vi.fn().mockRejectedValue(new Error('Twitter API down'))

    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body text" autoSendEnabled onAutoSend={onAutoSend} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /auto-send to twitter/i }))
    })

    expect(screen.getByText('new')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auto-send to twitter/i })).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith('Auto-send failed:', expect.any(Error))
  })

  it('shows the business-hours explainer when auto-send is enabled', () => {
    render(<ReviewPanel initialStatus="new" subject="Hi" body="Body" autoSendEnabled onAutoSend={vi.fn()} />)
    expect(screen.getByText(/auto-send respects business hours/i)).toBeInTheDocument()
  })
})
