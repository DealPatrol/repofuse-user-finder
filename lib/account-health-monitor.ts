import { TwitterApi } from 'twitter-api-v2'
import fs from 'fs'
import path from 'path'

export interface HealthCheckResult {
  healthy: boolean
  healthScore: number // 0-100
  issues: string[]
  warnings: string[]
  metrics: {
    followers: number
    following: number
    followerRatio: number
    accountAge: number // days
    postsPerDay: number
    engagementRate: number
  }
  lastChecked: string
}

const HEALTH_CHECK_FILE = path.join(process.cwd(), 'data', 'account-health.json')

export class AccountHealthMonitor {
  private client: TwitterApi
  private accountHandle: string

  constructor(
    consumerKey: string,
    consumerSecret: string,
    accessToken: string,
    accessSecret: string,
    accountHandle: string = '@repofuse'
  ) {
    this.client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: accessToken,
      accessSecret: accessSecret,
    })
    this.accountHandle = accountHandle
  }

  // Perform full health check
  async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      const roClient = this.client.readOnly
      const me = await roClient.v2.me()

      if (!me.data?.id) {
        return this.createHealthResult(0, false, ['Failed to get account info'], [])
      }

      // Get user info
      const userInfo = await roClient.v2.user(me.data.id, {
        'user.fields': [
          'created_at',
          'public_metrics',
          'verified',
          'protected',
        ],
      })

      if (!userInfo.data) {
        return this.createHealthResult(0, false, ['Failed to fetch user metrics'], [])
      }

      const metrics = userInfo.data.public_metrics || {
        followers_count: 0,
        following_count: 0,
        tweet_count: 0,
      }

      const followers = metrics.followers_count || 0
      const following = metrics.following_count || 0
      const tweetCount = metrics.tweet_count || 0

      // Calculate metrics
      const followerRatio = following > 0 ? followers / following : 0
      const accountCreatedAt = userInfo.data.created_at ? new Date(userInfo.data.created_at) : new Date()
      const accountAge = Math.floor((Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
      const postsPerDay = accountAge > 0 ? tweetCount / accountAge : 0

      const issues: string[] = []
      const warnings: string[] = []
      let healthScore = 100

      // Check follower ratio (should be > 0.5 for safe automation)
      if (followerRatio < 0.3) {
        issues.push('Follower ratio below 0.3 - pause follows immediately')
        healthScore -= 25
      } else if (followerRatio < 0.5) {
        warnings.push('Follower ratio below 0.5 - consider reducing follow frequency')
        healthScore -= 10
      }

      // Check account age (should be at least 7 days old)
      if (accountAge < 7) {
        warnings.push('Account less than 7 days old - use conservative automation settings')
        healthScore -= 15
      }

      // Check post frequency (should be at least 0.1 posts/day)
      if (postsPerDay < 0.1 && accountAge > 30) {
        warnings.push('Low post frequency - increase original content to build credibility')
        healthScore -= 5
      }

      // Check if account is protected
      if (userInfo.data.protected) {
        warnings.push('Account is protected - automation may have limited effectiveness')
        healthScore -= 10
      }

      // Check verification status
      if (!userInfo.data.verified && followers > 1000) {
        warnings.push('Not verified despite high follower count - consider applying for verification')
      }

      const result: HealthCheckResult = {
        healthy: issues.length === 0 && healthScore >= 70,
        healthScore: Math.max(0, healthScore),
        issues,
        warnings,
        metrics: {
          followers,
          following,
          followerRatio,
          accountAge,
          postsPerDay,
          engagementRate: followers > 0 ? tweetCount / followers : 0,
        },
        lastChecked: new Date().toISOString(),
      }

      // Save health check result
      this.saveHealthCheck(result)

      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      return this.createHealthResult(
        0,
        false,
        [`Health check failed: ${errorMsg}`],
        []
      )
    }
  }

  // Get last health check
  getLastHealthCheck(): HealthCheckResult | null {
    try {
      if (!fs.existsSync(HEALTH_CHECK_FILE)) {
        return null
      }
      const content = fs.readFileSync(HEALTH_CHECK_FILE, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  // Save health check result
  private saveHealthCheck(result: HealthCheckResult) {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.writeFileSync(HEALTH_CHECK_FILE, JSON.stringify(result, null, 2))
  }

  // Helper to create health result
  private createHealthResult(
    score: number,
    healthy: boolean,
    issues: string[],
    warnings: string[]
  ): HealthCheckResult {
    return {
      healthy,
      healthScore: score,
      issues,
      warnings,
      metrics: {
        followers: 0,
        following: 0,
        followerRatio: 0,
        accountAge: 0,
        postsPerDay: 0,
        engagementRate: 0,
      },
      lastChecked: new Date().toISOString(),
    }
  }

  // Check if automation should be paused based on health
  shouldPauseAutomation(): { shouldPause: boolean; reason?: string } {
    const lastCheck = this.getLastHealthCheck()
    if (!lastCheck) {
      return { shouldPause: true, reason: 'No health check performed yet' }
    }

    if (lastCheck.issues.length > 0) {
      return { shouldPause: true, reason: `Critical issue: ${lastCheck.issues[0]}` }
    }

    if (lastCheck.healthScore < 50) {
      return { shouldPause: true, reason: 'Account health score too low' }
    }

    return { shouldPause: false }
  }
}
