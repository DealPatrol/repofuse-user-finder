import { TwitterApi } from 'twitter-api-v2'
import { RateLimitTracker } from './rate-limit-tracker'

export interface EngagementConfig {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessSecret: string
}

export class EngagementService {
  private client: TwitterApi
  private rateLimiter: RateLimitTracker
  private targetTwitterHandle: string

  constructor(config: EngagementConfig, rateLimiter: RateLimitTracker) {
    this.client = new TwitterApi({
      appKey: config.consumerKey,
      appSecret: config.consumerSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessSecret,
    })
    this.rateLimiter = rateLimiter
    this.targetTwitterHandle = '@repofuse' // Your account handle
  }

  // Like a tweet
  async likeTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const canLike = this.rateLimiter.canPerformAction('like')
      if (!canLike.allowed) {
        this.rateLimiter.logAction('like', false, false, canLike.reason)
        return { success: false, error: canLike.reason }
      }

      // Wait for minimum delay
      const waitTime = this.rateLimiter.getWaitTimeMs()
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      const rwClient = this.client.readWrite
      await rwClient.v2.like(this.targetTwitterHandle, tweetId)

      this.rateLimiter.markActionPerformed()
      this.rateLimiter.logAction('like', true, false)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isRateLimited = errorMessage.includes('429') || errorMessage.includes('rate limit')
      this.rateLimiter.logAction('like', false, isRateLimited, errorMessage)

      if (isRateLimited) {
        this.rateLimiter.activateCircuitBreaker()
      }

      return { success: false, error: errorMessage }
    }
  }

  // Retweet a tweet
  async retweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const canRetweet = this.rateLimiter.canPerformAction('retweet')
      if (!canRetweet.allowed) {
        this.rateLimiter.logAction('retweet', false, false, canRetweet.reason)
        return { success: false, error: canRetweet.reason }
      }

      const waitTime = this.rateLimiter.getWaitTimeMs()
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      const rwClient = this.client.readWrite
      await rwClient.v2.retweet(this.targetTwitterHandle, tweetId)

      this.rateLimiter.markActionPerformed()
      this.rateLimiter.logAction('retweet', true, false)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isRateLimited = errorMessage.includes('429') || errorMessage.includes('rate limit')
      this.rateLimiter.logAction('retweet', false, isRateLimited, errorMessage)

      if (isRateLimited) {
        this.rateLimiter.activateCircuitBreaker()
      }

      return { success: false, error: errorMessage }
    }
  }

  // Reply to a tweet
  async reply(tweetId: string, replyText: string): Promise<{ success: boolean; error?: string }> {
    try {
      const canReply = this.rateLimiter.canPerformAction('reply')
      if (!canReply.allowed) {
        this.rateLimiter.logAction('reply', false, false, canReply.reason)
        return { success: false, error: canReply.reason }
      }

      const waitTime = this.rateLimiter.getWaitTimeMs()
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      // Validate reply quality (basic checks)
      if (replyText.length < 10) {
        return { success: false, error: 'Reply too short - must be meaningful' }
      }

      if (replyText.length > 280) {
        return { success: false, error: 'Reply exceeds 280 characters' }
      }

      const rwClient = this.client.readWrite
      await rwClient.v2.reply(replyText, tweetId)

      this.rateLimiter.markActionPerformed()
      this.rateLimiter.logAction('reply', true, false)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isRateLimited = errorMessage.includes('429') || errorMessage.includes('rate limit')
      this.rateLimiter.logAction('reply', false, isRateLimited, errorMessage)

      if (isRateLimited) {
        this.rateLimiter.activateCircuitBreaker()
      }

      return { success: false, error: errorMessage }
    }
  }

  // Get engagement stats
  getEngagementStats() {
    return this.rateLimiter.getStats()
  }
}
