import fs from 'fs'
import path from 'path'

export interface RateLimitConfig {
  maxFollowsPerDay: number
  maxUnfollowsPerDay: number
  maxLikesPerHour: number
  maxRetweetsPerHour: number
  maxRepliesPerHour: number
  minDelayBetweenActionsMs: number
  maxDelayBetweenActionsMs: number
}

export interface ActionLog {
  timestamp: string
  actionType: 'follow' | 'unfollow' | 'like' | 'retweet' | 'reply'
  success: boolean
  rateLimited?: boolean
  error?: string
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxFollowsPerDay: 400,
  maxUnfollowsPerDay: 200,
  maxLikesPerHour: 20,
  maxRetweetsPerHour: 10,
  maxRepliesPerHour: 5,
  minDelayBetweenActionsMs: 5000,
  maxDelayBetweenActionsMs: 10000,
}

const LOG_FILE = path.join(process.cwd(), 'data', 'automation-log.json')

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function readLogs(): ActionLog[] {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return []
    }
    const content = fs.readFileSync(LOG_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

function writeLogs(logs: ActionLog[]) {
  ensureDataDir()
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))
}

export class RateLimitTracker {
  private config: RateLimitConfig
  private lastActionTime: number = 0
  private circuitBreakerActive: boolean = false
  private circuitBreakerUntil: number = 0

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // Get random delay between actions to simulate human behavior
  private getRandomDelay(): number {
    return Math.random() * (this.config.maxDelayBetweenActionsMs - this.config.minDelayBetweenActionsMs) +
      this.config.minDelayBetweenActionsMs
  }

  // Log an action
  logAction(actionType: ActionLog['actionType'], success: boolean, rateLimited: boolean = false, error?: string) {
    const logs = readLogs()
    logs.push({
      timestamp: new Date().toISOString(),
      actionType,
      success,
      rateLimited,
      error,
    })

    // Keep only last 7 days of logs
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentLogs = logs.filter(log => new Date(log.timestamp).getTime() > sevenDaysAgo)
    writeLogs(recentLogs)

    // Activate circuit breaker if rate limited
    if (rateLimited) {
      this.activateCircuitBreaker()
    }

    return logs.length
  }

  // Get actions count for a specific type in last N hours
  getActionCountLastHours(actionType: ActionLog['actionType'], hours: number = 1): number {
    const logs = readLogs()
    const timeAgo = Date.now() - hours * 60 * 60 * 1000
    return logs.filter(
      log => log.actionType === actionType &&
        log.success &&
        new Date(log.timestamp).getTime() > timeAgo
    ).length
  }

  // Get actions count for today
  getActionCountToday(actionType: ActionLog['actionType']): number {
    const logs = readLogs()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return logs.filter(
      log => log.actionType === actionType &&
        log.success &&
        new Date(log.timestamp).getTime() > today.getTime()
    ).length
  }

  // Check if we can perform an action
  canPerformAction(actionType: ActionLog['actionType']): { allowed: boolean; reason?: string } {
    // Check circuit breaker
    if (this.isCircuitBreakerActive()) {
      return { allowed: false, reason: 'Circuit breaker active - rate limit encountered' }
    }

    // Enforce minimum delay between actions
    if (Date.now() - this.lastActionTime < this.config.minDelayBetweenActionsMs) {
      return { allowed: false, reason: `Minimum delay not met (${this.config.minDelayBetweenActionsMs}ms)` }
    }

    // Check hourly limits
    const hourCount = this.getActionCountLastHours(actionType, 1)
    switch (actionType) {
      case 'like':
        if (hourCount >= this.config.maxLikesPerHour) {
          return { allowed: false, reason: `Hourly like limit reached (${this.config.maxLikesPerHour})` }
        }
        break
      case 'retweet':
        if (hourCount >= this.config.maxRetweetsPerHour) {
          return { allowed: false, reason: `Hourly retweet limit reached (${this.config.maxRetweetsPerHour})` }
        }
        break
      case 'reply':
        if (hourCount >= this.config.maxRepliesPerHour) {
          return { allowed: false, reason: `Hourly reply limit reached (${this.config.maxRepliesPerHour})` }
        }
        break
    }

    // Check daily limits
    const dayCount = this.getActionCountToday(actionType)
    switch (actionType) {
      case 'follow':
        if (dayCount >= this.config.maxFollowsPerDay) {
          return { allowed: false, reason: `Daily follow limit reached (${this.config.maxFollowsPerDay})` }
        }
        break
      case 'unfollow':
        if (dayCount >= this.config.maxUnfollowsPerDay) {
          return { allowed: false, reason: `Daily unfollow limit reached (${this.config.maxUnfollowsPerDay})` }
        }
        break
    }

    return { allowed: true }
  }

  // Mark action as performed (for timing)
  markActionPerformed() {
    this.lastActionTime = Date.now()
  }

  // Get wait time before next action
  getWaitTimeMs(): number {
    const timeSinceLastAction = Date.now() - this.lastActionTime
    const minWait = this.config.minDelayBetweenActionsMs
    return Math.max(0, minWait - timeSinceLastAction)
  }

  // Circuit breaker methods
  activateCircuitBreaker(durationMinutes: number = 30) {
    this.circuitBreakerActive = true
    this.circuitBreakerUntil = Date.now() + durationMinutes * 60 * 1000
  }

  isCircuitBreakerActive(): boolean {
    if (!this.circuitBreakerActive) return false
    if (Date.now() > this.circuitBreakerUntil) {
      this.circuitBreakerActive = false
      return false
    }
    return true
  }

  deactivateCircuitBreaker() {
    this.circuitBreakerActive = false
  }

  getCircuitBreakerStatus(): {
    active: boolean
    minutesRemaining: number
  } {
    if (!this.isCircuitBreakerActive()) {
      return { active: false, minutesRemaining: 0 }
    }
    const remaining = Math.ceil((this.circuitBreakerUntil - Date.now()) / 1000 / 60)
    return { active: true, minutesRemaining: remaining }
  }

  // Get all stats
  getStats() {
    const logs = readLogs()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayLogs = logs.filter(log => new Date(log.timestamp).getTime() > today.getTime())
    const lastHourLogs = logs.filter(log => new Date(log.timestamp).getTime() > Date.now() - 60 * 60 * 1000)

    return {
      circuitBreaker: this.getCircuitBreakerStatus(),
      today: {
        follows: todayLogs.filter(l => l.actionType === 'follow' && l.success).length,
        unfollows: todayLogs.filter(l => l.actionType === 'unfollow' && l.success).length,
        likes: todayLogs.filter(l => l.actionType === 'like' && l.success).length,
        retweets: todayLogs.filter(l => l.actionType === 'retweet' && l.success).length,
        replies: todayLogs.filter(l => l.actionType === 'reply' && l.success).length,
        rateLimitErrors: todayLogs.filter(l => l.rateLimited).length,
      },
      lastHour: {
        likes: lastHourLogs.filter(l => l.actionType === 'like' && l.success).length,
        retweets: lastHourLogs.filter(l => l.actionType === 'retweet' && l.success).length,
        replies: lastHourLogs.filter(l => l.actionType === 'reply' && l.success).length,
      },
      limits: this.config,
      waitTimeMs: this.getWaitTimeMs(),
    }
  }
}
