import { sendTwitterDM, type TwitterCredentials } from './twitter-service'
import { generateOutreachMessage } from './prospect-engine/outreach-generator'
import type { Prospect } from './prospect-engine/types'

export interface AutoSendConfig {
  enabled: boolean
  businessHoursOnly: boolean
  startHour: number // 0-23 in UTC
  endHour: number // 0-23 in UTC
  timezoneName: string
}

export const DEFAULT_AUTO_SEND_CONFIG: AutoSendConfig = {
  enabled: true,
  businessHoursOnly: true,
  startHour: 9,
  endHour: 17,
  timezoneName: 'America/New_York',
}

function getZonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '0'

  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    // Some ICU implementations report midnight as "24" instead of "00" with hour12: false.
    hour: parseInt(get('hour'), 10) % 24,
  }
}

// Offset (in minutes) such that localWallClockMs = utcInstantMs + offsetMinutes * 60000.
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(date)

  const offsetLabel = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const match = offsetLabel.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10))
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

// Converts a wall-clock time in the given timezone to the UTC instant it represents.
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const wallClockAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(wallClockAsUtcMs), timeZone)

  // Refine once in case the initial guess landed on the wrong side of a DST transition.
  const refinedOffsetMinutes = getTimeZoneOffsetMinutes(new Date(wallClockAsUtcMs - offsetMinutes * 60 * 1000), timeZone)

  return new Date(wallClockAsUtcMs - refinedOffsetMinutes * 60 * 1000)
}

export function isBusinessHours(config: AutoSendConfig): boolean {
  if (!config.businessHoursOnly) return true

  const { hour } = getZonedDateParts(new Date(), config.timezoneName)

  return hour >= config.startHour && hour < config.endHour
}

export function getNextSendTime(config: AutoSendConfig): Date {
  const now = new Date()

  if (isBusinessHours(config)) {
    // Send in 5-30 minutes randomly
    const delay = Math.random() * 25 * 60 * 1000 + 5 * 60 * 1000
    return new Date(now.getTime() + delay)
  }

  const { year, month, day, hour: currentHour } = getZonedDateParts(now, config.timezoneName)

  const targetDate =
    currentHour >= config.endHour
      ? addCalendarDays(year, month, day, 1) // Tomorrow at start hour
      : { year, month, day } // Today at start hour

  return zonedTimeToUtc(targetDate.year, targetDate.month, targetDate.day, config.startHour, 0, config.timezoneName)
}

export async function autoSendDM(
  prospect: Prospect,
  twitterCredentials: TwitterCredentials,
  config: AutoSendConfig = DEFAULT_AUTO_SEND_CONFIG
): Promise<{ success: boolean; error?: string }> {
  if (!config.enabled) {
    return { success: false, error: 'Auto-send is disabled' }
  }

  if (!isBusinessHours(config)) {
    return { success: false, error: 'Outside business hours' }
  }

  const message = generateOutreachMessage(prospect)

  // Use the body as the DM message (for Twitter)
  const result = await sendTwitterDM(twitterCredentials, prospect.githubUsername, message.body)

  return {
    success: result.success,
    error: result.error,
  }
}
