import { NextRequest, NextResponse } from 'next/server'
import { RateLimitTracker } from '@/lib/rate-limit-tracker'
import { AccountHealthMonitor } from '@/lib/account-health-monitor'

const rateLimiter = new RateLimitTracker()

export async function GET(request: NextRequest) {
  try {
    const consumerKey = process.env.TWITTER_CONSUMER_KEY
    const consumerSecret = process.env.TWITTER_CONSUMER_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

    if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
      return NextResponse.json(
        { error: 'Twitter credentials not configured' },
        { status: 400 }
      )
    }

    // Get rate limit stats
    const rateLimitStats = rateLimiter.getStats()

    // Get account health
    const healthMonitor = new AccountHealthMonitor(
      consumerKey,
      consumerSecret,
      accessToken,
      accessSecret
    )

    let healthCheck = healthMonitor.getLastHealthCheck()
    
    // If no recent health check (older than 1 hour), perform new one
    if (!healthCheck || Date.now() - new Date(healthCheck.lastChecked).getTime() > 60 * 60 * 1000) {
      healthCheck = await healthMonitor.performHealthCheck()
    }

    const automationPauseCheck = healthMonitor.shouldPauseAutomation()

    return NextResponse.json({
      success: true,
      dashboard: {
        timestamp: new Date().toISOString(),
        automationStatus: {
          paused: automationPauseCheck.shouldPause,
          pauseReason: automationPauseCheck.reason,
        },
        rateLimits: rateLimitStats,
        accountHealth: healthCheck,
        recommendations: generateRecommendations(rateLimitStats, healthCheck),
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

interface Recommendation {
  level: 'info' | 'warning' | 'critical'
  message: string
  action?: string
}

function generateRecommendations(
  rateLimitStats: any,
  healthCheck: any
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Rate limit recommendations
  if (rateLimitStats.circuitBreaker.active) {
    recommendations.push({
      level: 'critical',
      message: `Circuit breaker active for ${rateLimitStats.circuitBreaker.minutesRemaining} more minutes`,
      action: 'Pause all automation until circuit breaker resets',
    })
  }

  if (rateLimitStats.today.rateLimitErrors > 0) {
    recommendations.push({
      level: 'warning',
      message: `${rateLimitStats.today.rateLimitErrors} rate limit errors today`,
      action: 'Reduce automation frequency by 20%',
    })
  }

  // Health recommendations
  if (healthCheck && healthCheck.issues.length > 0) {
    healthCheck.issues.forEach((issue: string) => {
      recommendations.push({
        level: 'critical',
        message: issue,
      })
    })
  }

  if (healthCheck && healthCheck.warnings.length > 0) {
    healthCheck.warnings.forEach((warning: string) => {
      recommendations.push({
        level: 'warning',
        message: warning,
      })
    })
  }

  // Usage recommendations
  const followsUsed = rateLimitStats.today.follows
  const maxFollows = rateLimitStats.limits.maxFollowsPerDay
  const followsPercent = (followsUsed / maxFollows) * 100

  if (followsPercent > 80) {
    recommendations.push({
      level: 'warning',
      message: `Using ${Math.round(followsPercent)}% of daily follow limit`,
      action: 'Reduce follows or wait until tomorrow',
    })
  }

  const likesUsed = rateLimitStats.today.likes
  const maxLikesDaily = rateLimitStats.limits.maxLikesPerHour * 24
  const likesPercent = (likesUsed / maxLikesDaily) * 100

  if (likesPercent > 80) {
    recommendations.push({
      level: 'warning',
      message: `Using ${Math.round(likesPercent)}% of daily like limit`,
      action: 'Reduce engagement or let quota reset',
    })
  }

  // Positive recommendations
  if (recommendations.length === 0 || !rateLimitStats.circuitBreaker.active) {
    recommendations.push({
      level: 'info',
      message: 'Account health is good - automation running safely',
    })
  }

  return recommendations
}
