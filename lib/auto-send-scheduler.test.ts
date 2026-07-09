import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AUTO_SEND_CONFIG,
  autoSendDM,
  getNextSendTime,
  isBusinessHours,
  type AutoSendConfig,
} from './auto-send-scheduler'
import type { Prospect } from './prospect-engine/types'

vi.mock('./twitter-service', () => ({
  sendTwitterDM: vi.fn(),
}))

import { sendTwitterDM } from './twitter-service'

// All tests below drive the clock via explicit UTC instants and assert on UTC
// output, then convert by hand using America/New_York's known offsets
// (EDT = UTC-4 in July, EST = UTC-5 in January). This exercises the real
// config.timezoneName conversion regardless of the sandbox's own local
// timezone, rather than relying on it matching the target zone.
const TIME_ZONE = 'America/New_York'

function makeConfig(overrides: Partial<AutoSendConfig> = {}): AutoSendConfig {
  return {
    enabled: true,
    businessHoursOnly: true,
    startHour: 9,
    endHour: 17,
    timezoneName: TIME_ZONE,
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

const credentials = {
  accessToken: 'token',
  accessSecret: 'secret',
  consumerKey: 'key',
  consumerSecret: 'secret',
}

function setUtcTime(iso: string) {
  vi.setSystemTime(new Date(iso))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(sendTwitterDM).mockReset()
})

describe('isBusinessHours', () => {
  it('is always true when businessHoursOnly is disabled', () => {
    setUtcTime('2024-07-15T04:00:00Z') // midnight EDT
    expect(isBusinessHours(makeConfig({ businessHoursOnly: false }))).toBe(true)
  })

  it('is true within the configured hour range (10am EDT)', () => {
    setUtcTime('2024-07-15T14:00:00Z')
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(true)
  })

  it('is false before the start hour (8am EDT)', () => {
    setUtcTime('2024-07-15T12:00:00Z')
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(false)
  })

  it('treats the end hour as exclusive (5pm EDT)', () => {
    setUtcTime('2024-07-15T21:00:00Z')
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(false)
  })

  it('is true at the exact start hour (9am EDT)', () => {
    setUtcTime('2024-07-15T13:00:00Z')
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(true)
  })

  it('resolves the hour against config.timezoneName, not the host timezone', () => {
    // 2024-07-15T14:00:00Z is 10am in America/New_York (business hours) but
    // 11pm in Asia/Tokyo (outside business hours) - proves the zone is honored.
    setUtcTime('2024-07-15T14:00:00Z')
    expect(isBusinessHours(makeConfig({ timezoneName: 'America/New_York' }))).toBe(true)
    expect(isBusinessHours(makeConfig({ timezoneName: 'Asia/Tokyo' }))).toBe(false)
  })
})

describe('getNextSendTime', () => {
  it('schedules 5-30 minutes out when already in business hours', () => {
    setUtcTime('2024-07-15T14:00:00Z')
    const now = Date.now()

    vi.spyOn(Math, 'random').mockReturnValue(0)
    const earliest = getNextSendTime(makeConfig())
    expect(earliest.getTime() - now).toBe(5 * 60 * 1000)

    vi.spyOn(Math, 'random').mockReturnValue(1)
    const latest = getNextSendTime(makeConfig())
    expect(latest.getTime() - now).toBe(30 * 60 * 1000)
  })

  it('schedules for later today at startHour (EDT, UTC-4) when currently before business hours', () => {
    setUtcTime('2024-07-15T11:00:00Z') // 7am EDT
    const result = getNextSendTime(makeConfig({ startHour: 9, endHour: 17 }))
    expect(result.toISOString()).toBe('2024-07-15T13:00:00.000Z') // 9am EDT
  })

  it('schedules for tomorrow at startHour (EDT, UTC-4) when currently after business hours', () => {
    setUtcTime('2024-07-15T23:30:00Z') // 7:30pm EDT
    const result = getNextSendTime(makeConfig({ startHour: 9, endHour: 17 }))
    expect(result.toISOString()).toBe('2024-07-16T13:00:00.000Z') // 9am EDT the next day
  })

  it('honors the standard-time offset (EST, UTC-5) outside daylight saving time', () => {
    setUtcTime('2024-01-15T23:00:00Z') // 6pm EST, after hours
    const result = getNextSendTime(makeConfig({ startHour: 9, endHour: 17 }))
    expect(result.toISOString()).toBe('2024-01-16T14:00:00.000Z') // 9am EST the next day
  })

  it('resolves the target instant against config.timezoneName, not the host timezone', () => {
    setUtcTime('2024-07-15T11:00:00Z') // 7am EDT, 8pm in Asia/Tokyo (already past endHour there)
    const nyResult = getNextSendTime(makeConfig({ timezoneName: 'America/New_York' }))
    const tokyoResult = getNextSendTime(makeConfig({ timezoneName: 'Asia/Tokyo' }))

    expect(nyResult.toISOString()).toBe('2024-07-15T13:00:00.000Z') // later today, 9am EDT
    expect(tokyoResult.toISOString()).toBe('2024-07-16T00:00:00.000Z') // tomorrow, 9am JST
  })
})

describe('autoSendDM', () => {
  it('fails fast without calling sendTwitterDM when auto-send is disabled', async () => {
    setUtcTime('2024-07-15T14:00:00Z')
    const result = await autoSendDM(makeProspect(), credentials, makeConfig({ enabled: false }))

    expect(result).toEqual({ success: false, error: 'Auto-send is disabled' })
    expect(sendTwitterDM).not.toHaveBeenCalled()
  })

  it('fails without calling sendTwitterDM when outside business hours', async () => {
    setUtcTime('2024-07-15T04:00:00Z') // midnight EDT
    const result = await autoSendDM(makeProspect(), credentials, makeConfig())

    expect(result).toEqual({ success: false, error: 'Outside business hours' })
    expect(sendTwitterDM).not.toHaveBeenCalled()
  })

  it('sends the generated outreach message body via Twitter DM when eligible', async () => {
    setUtcTime('2024-07-15T14:00:00Z') // 10am EDT
    vi.mocked(sendTwitterDM).mockResolvedValue({ success: true, messageId: 'msg_1' })

    const prospect = makeProspect({ githubUsername: 'octocat' })
    const result = await autoSendDM(prospect, credentials, makeConfig())

    expect(sendTwitterDM).toHaveBeenCalledTimes(1)
    const [sentCredentials, recipient, body] = vi.mocked(sendTwitterDM).mock.calls[0]
    expect(sentCredentials).toBe(credentials)
    expect(recipient).toBe('octocat')
    expect(body).toContain('Hey Jane,')
    expect(result).toEqual({ success: true, error: undefined })
  })

  it('propagates failure details from sendTwitterDM', async () => {
    setUtcTime('2024-07-15T14:00:00Z')
    vi.mocked(sendTwitterDM).mockResolvedValue({ success: false, error: 'User not found' })

    const result = await autoSendDM(makeProspect(), credentials, makeConfig())
    expect(result).toEqual({ success: false, error: 'User not found' })
  })

  it('uses DEFAULT_AUTO_SEND_CONFIG when no config is provided', async () => {
    expect(DEFAULT_AUTO_SEND_CONFIG.enabled).toBe(true)
    expect(DEFAULT_AUTO_SEND_CONFIG.businessHoursOnly).toBe(true)
  })
})
