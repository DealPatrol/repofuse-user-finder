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

export function isBusinessHours(config: AutoSendConfig): boolean {
  if (!config.businessHoursOnly) return true

  const now = new Date()
  // Get hour in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    timeZone: config.timezoneName,
    hour12: false,
  })
  const hour = parseInt(formatter.format(now), 10)

  return hour >= config.startHour && hour < config.endHour
}

export function getNextSendTime(config: AutoSendConfig): Date {
  const now = new Date()

  if (isBusinessHours(config)) {
    // Send in 5-30 minutes randomly
    const delay = Math.random() * 25 * 60 * 1000 + 5 * 60 * 1000
    return new Date(now.getTime() + delay)
  }

  // Calculate next business hours start
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    timeZone: config.timezoneName,
    hour12: false,
  })
  const currentHour = parseInt(formatter.format(now), 10)

  if (currentHour >= config.endHour) {
    // Tomorrow at start hour
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(config.startHour, 0, 0, 0)
    return tomorrow
  }

  // Today at start hour
  const nextSend = new Date(now)
  nextSend.setHours(config.startHour, 0, 0, 0)
  return nextSend
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
