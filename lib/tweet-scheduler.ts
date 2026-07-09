import { GeneratedTweet } from './tweet-generator'

export interface ScheduledTweet extends GeneratedTweet {
  scheduledAt: Date
  postedAt?: Date
  status: 'queued' | 'posted' | 'failed'
}

export interface TwitterConfig {
  dailyPostCount: number // 2-4
  timezone: string // e.g., 'America/New_York'
  enabled: boolean
  businessHourStart: number // 0-23
  businessHourEnd: number // 0-23
}

const DEFAULT_CONFIG: TwitterConfig = {
  dailyPostCount: 3,
  timezone: 'America/New_York',
  enabled: true,
  businessHourStart: 9, // 9 AM
  businessHourEnd: 17, // 5 PM
}

export class TweetScheduler {
  private queue: ScheduledTweet[] = []
  private config: TwitterConfig

  constructor(config: Partial<TwitterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check if current time is within business hours
   */
  private isBusinessHours(now: Date): boolean {
    const hour = now.getHours()
    return hour >= this.config.businessHourStart && hour < this.config.businessHourEnd
  }

  /**
   * Get next business hour slot
   */
  private getNextBusinessHourSlot(after: Date): Date {
    const nextSlot = new Date(after)

    // If we're before business hours start, schedule for start time
    if (nextSlot.getHours() < this.config.businessHourStart) {
      nextSlot.setHours(this.config.businessHourStart, 0, 0, 0)
      return nextSlot
    }

    // If we're after business hours end, schedule for next day start
    if (nextSlot.getHours() >= this.config.businessHourEnd) {
      nextSlot.setDate(nextSlot.getDate() + 1)
      nextSlot.setHours(this.config.businessHourStart, 0, 0, 0)
      return nextSlot
    }

    // We're in business hours, return after time
    return nextSlot
  }

  /**
   * Calculate optimal posting times for the day
   */
  private calculatePostingTimes(baseDate: Date, count: number): Date[] {
    const times: Date[] = []
    const startOfDay = new Date(baseDate)
    startOfDay.setHours(this.config.businessHourStart, 0, 0, 0)

    const businessHoursDuration = this.config.businessHourEnd - this.config.businessHourStart
    const minutesPerPost = (businessHoursDuration * 60) / count

    for (let i = 0; i < count; i++) {
      const postTime = new Date(startOfDay)
      const minutesOffset = minutesPerPost * i + Math.random() * (minutesPerPost * 0.3) // Add random offset for natural feel
      postTime.setMinutes(postTime.getMinutes() + minutesOffset)
      times.push(postTime)
    }

    return times
  }

  /**
   * Add tweets to the scheduler queue
   */
  addToQueue(tweets: GeneratedTweet[], startTime?: Date): ScheduledTweet[] {
    const baseTime = startTime || new Date()
    const now = new Date()

    let scheduleTime = this.getNextBusinessHourSlot(baseTime)

    // If scheduled time is in the past, move to next slot
    if (scheduleTime < now) {
      scheduleTime = this.getNextBusinessHourSlot(now)
    }

    const postingTimes = this.calculatePostingTimes(scheduleTime, tweets.length)

    const scheduledTweets: ScheduledTweet[] = tweets.map((tweet, index) => ({
      ...tweet,
      scheduledAt: postingTimes[index],
      status: 'queued' as const,
    }))

    this.queue.push(...scheduledTweets)
    return scheduledTweets
  }

  /**
   * Get tweets ready to post (scheduled time has passed)
   */
  getReadyToPost(): ScheduledTweet[] {
    const now = new Date()
    return this.queue.filter(
      (tweet) =>
        tweet.status === 'queued' &&
        tweet.scheduledAt <= now &&
        this.isBusinessHours(now)
    )
  }

  /**
   * Mark tweet as posted
   */
  markAsPosted(tweetId: string): void {
    const tweet = this.queue.find((t) => t.content === tweetId)
    if (tweet) {
      tweet.status = 'posted'
      tweet.postedAt = new Date()
    }
  }

  /**
   * Mark tweet as failed
   */
  markAsFailed(tweetId: string): void {
    const tweet = this.queue.find((t) => t.content === tweetId)
    if (tweet) {
      tweet.status = 'failed'
      // Retry after 1 hour
      tweet.scheduledAt = new Date(Date.now() + 60 * 60 * 1000)
      tweet.status = 'queued'
    }
  }

  /**
   * Get full queue for admin view
   */
  getQueue(): ScheduledTweet[] {
    return [...this.queue]
  }

  /**
   * Clear old posted tweets (keep last 30 days)
   */
  clearOldTweets(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    this.queue = this.queue.filter((t) => {
      if (t.status === 'posted' && t.postedAt) {
        return t.postedAt > thirtyDaysAgo
      }
      return true
    })
  }

  /**
   * Get configuration
   */
  getConfig(): TwitterConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TwitterConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      queued: this.queue.filter((t) => t.status === 'queued').length,
      posted: this.queue.filter((t) => t.status === 'posted').length,
      failed: this.queue.filter((t) => t.status === 'failed').length,
      total: this.queue.length,
    }
  }
}

// Singleton instance
let scheduler: TweetScheduler | null = null

export function getTweetScheduler(config?: Partial<TwitterConfig>): TweetScheduler {
  if (!scheduler) {
    scheduler = new TweetScheduler(config)
  }
  return scheduler
}
