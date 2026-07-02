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

// Run all timezone-dependent assertions against the sandbox's own local
// timezone so the suite is deterministic regardless of where it runs -
// getNextSendTime's setHours() calls operate in local time, not config.timezoneName.
const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

function makeConfig(overrides: Partial<AutoSendConfig> = {}): AutoSendConfig {
  return {
    enabled: true,
    businessHoursOnly: true,
    startHour: 9,
    endHour: 17,
    timezoneName: LOCAL_TIME_ZONE,
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

function setLocalTime(hour: number, minute = 0) {
  const now = new Date()
  now.setHours(hour, minute, 0, 0)
  vi.setSystemTime(now)
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
    setLocalTime(3)
    expect(isBusinessHours(makeConfig({ businessHoursOnly: false }))).toBe(true)
  })

  it('is true within the configured hour range', () => {
    setLocalTime(10)
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(true)
  })

  it('is false before the start hour', () => {
    setLocalTime(8)
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(false)
  })

  it('treats the end hour as exclusive', () => {
    setLocalTime(17)
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(false)
  })

  it('is true at the exact start hour', () => {
    setLocalTime(9)
    expect(isBusinessHours(makeConfig({ startHour: 9, endHour: 17 }))).toBe(true)
  })
})

describe('getNextSendTime', () => {
  it('schedules 5-30 minutes out when already in business hours', () => {
    setLocalTime(10, 0)
    const now = Date.now()

    vi.spyOn(Math, 'random').mockReturnValue(0)
    const earliest = getNextSendTime(makeConfig())
    expect(earliest.getTime() - now).toBe(5 * 60 * 1000)

    vi.spyOn(Math, 'random').mockReturnValue(1)
    const latest = getNextSendTime(makeConfig())
    expect(latest.getTime() - now).toBe(30 * 60 * 1000)
  })

  it('schedules for later today at startHour when currently before business hours', () => {
    setLocalTime(6, 30)
    const result = getNextSendTime(makeConfig({ startHour: 9, endHour: 17 }))

    const now = new Date()
    expect(result.getFullYear()).toBe(now.getFullYear())
    expect(result.getMonth()).toBe(now.getMonth())
    expect(result.getDate()).toBe(now.getDate())
    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(0)
  })

  it('schedules for tomorrow at startHour when currently after business hours', () => {
    setLocalTime(20, 0)
    const before = new Date()
    const result = getNextSendTime(makeConfig({ startHour: 9, endHour: 17 }))

    const expectedDay = new Date(before)
    expectedDay.setDate(expectedDay.getDate() + 1)

    expect(result.getDate()).toBe(expectedDay.getDate())
    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(0)
  })
})

describe('autoSendDM', () => {
  it('fails fast without calling sendTwitterDM when auto-send is disabled', async () => {
    setLocalTime(10)
    const result = await autoSendDM(makeProspect(), credentials, makeConfig({ enabled: false }))

    expect(result).toEqual({ success: false, error: 'Auto-send is disabled' })
    expect(sendTwitterDM).not.toHaveBeenCalled()
  })

  it('fails without calling sendTwitterDM when outside business hours', async () => {
    setLocalTime(3)
    const result = await autoSendDM(makeProspect(), credentials, makeConfig())

    expect(result).toEqual({ success: false, error: 'Outside business hours' })
    expect(sendTwitterDM).not.toHaveBeenCalled()
  })

  it('sends the generated outreach message body via Twitter DM when eligible', async () => {
    setLocalTime(10)
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
    setLocalTime(10)
    vi.mocked(sendTwitterDM).mockResolvedValue({ success: false, error: 'User not found' })

    const result = await autoSendDM(makeProspect(), credentials, makeConfig())
    expect(result).toEqual({ success: false, error: 'User not found' })
  })

  it('uses DEFAULT_AUTO_SEND_CONFIG when no config is provided', async () => {
    expect(DEFAULT_AUTO_SEND_CONFIG.enabled).toBe(true)
    expect(DEFAULT_AUTO_SEND_CONFIG.businessHoursOnly).toBe(true)
  })
})
