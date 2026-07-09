import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { AutoSendConfig } from '@/lib/auto-send-scheduler'

vi.mock('@/lib/twitter-service', () => ({
  sendTwitterDM: vi.fn(),
}))

import { sendTwitterDM } from '@/lib/twitter-service'
import { POST } from './route'

const credentials = {
  accessToken: 'token',
  accessSecret: 'secret',
  consumerKey: 'key',
  consumerSecret: 'secret',
}

function makeConfig(overrides: Partial<AutoSendConfig> = {}): AutoSendConfig {
  return {
    enabled: true,
    businessHoursOnly: false,
    startHour: 9,
    endHour: 17,
    timezoneName: 'America/New_York',
    ...overrides,
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/twitter/send-dm', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(sendTwitterDM).mockReset()
})

describe('POST /api/twitter/send-dm', () => {
  it('returns 400 when required fields are missing', async () => {
    const response = await POST(makeRequest({ prospectId: 'p1' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Missing required fields' })
    expect(sendTwitterDM).not.toHaveBeenCalled()
  })

  it('returns 400 when auto-send is disabled', async () => {
    const response = await POST(
      makeRequest({
        prospectId: 'p1',
        message: 'hello',
        recipientUsername: 'octocat',
        twitterCredentials: credentials,
        config: makeConfig({ enabled: false }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Auto-send is disabled' })
    expect(sendTwitterDM).not.toHaveBeenCalled()
  })

  it('returns 400 when businessHoursOnly is set and it is outside business hours', async () => {
    vi.setSystemTime(new Date('2024-07-15T04:00:00Z')) // midnight EDT

    const response = await POST(
      makeRequest({
        prospectId: 'p1',
        message: 'hello',
        recipientUsername: 'octocat',
        twitterCredentials: credentials,
        config: makeConfig({ businessHoursOnly: true, startHour: 9, endHour: 17 }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Outside business hours')
    expect(sendTwitterDM).not.toHaveBeenCalled()
  })

  it('sends the DM and returns success when eligible', async () => {
    vi.mocked(sendTwitterDM).mockResolvedValue({ success: true, messageId: 'msg_1' })

    const response = await POST(
      makeRequest({
        prospectId: 'p1',
        message: 'hello there',
        recipientUsername: 'octocat',
        twitterCredentials: credentials,
        config: makeConfig(),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, messageId: 'msg_1', prospectId: 'p1' })
    expect(sendTwitterDM).toHaveBeenCalledWith(credentials, 'octocat', 'hello there')
  })

  it('returns 400 with the underlying error when sendTwitterDM fails', async () => {
    vi.mocked(sendTwitterDM).mockResolvedValue({ success: false, error: 'User not found' })

    const response = await POST(
      makeRequest({
        prospectId: 'p1',
        message: 'hello',
        recipientUsername: 'octocat',
        twitterCredentials: credentials,
        config: makeConfig(),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'User not found' })
  })

  it('defaults to a generic error message when sendTwitterDM fails without one', async () => {
    vi.mocked(sendTwitterDM).mockResolvedValue({ success: false })

    const response = await POST(
      makeRequest({
        prospectId: 'p1',
        message: 'hello',
        recipientUsername: 'octocat',
        twitterCredentials: credentials,
        config: makeConfig(),
      }),
    )
    const body = await response.json()

    expect(body).toEqual({ error: 'Failed to send DM' })
  })

  it('falls back to DEFAULT_AUTO_SEND_CONFIG when no config is provided', async () => {
    // DEFAULT_AUTO_SEND_CONFIG has businessHoursOnly: true in America/New_York,
    // so pick a time firmly within 9am-5pm ET to exercise the success path.
    vi.setSystemTime(new Date('2024-07-15T14:00:00Z')) // 10am EDT
    vi.mocked(sendTwitterDM).mockResolvedValue({ success: true, messageId: 'msg_2' })

    const response = await POST(
      makeRequest({
        prospectId: 'p1',
        message: 'hello',
        recipientUsername: 'octocat',
        twitterCredentials: credentials,
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 with the error message when the handler throws', async () => {
    vi.mocked(sendTwitterDM).mockRejectedValue(new Error('network exploded'))

    const response = await POST(
      makeRequest({
        prospectId: 'p1',
        message: 'hello',
        recipientUsername: 'octocat',
        twitterCredentials: credentials,
        config: makeConfig(),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'network exploded' })
  })

  it('returns 500 when the request body is not valid JSON', async () => {
    const request = new NextRequest('http://localhost/api/twitter/send-dm', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})
