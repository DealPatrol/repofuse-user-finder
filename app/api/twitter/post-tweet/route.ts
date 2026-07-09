import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { getTweetScheduler } from '@/lib/tweet-scheduler'

// Initialize Twitter client from env vars
function getTwitterClient() {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret = process.env.TWITTER_ACCESS_SECRET

  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    throw new Error('Missing Twitter API credentials')
  }

  return new TwitterApi({
    appKey: consumerKey,
    appSecret: consumerSecret,
    accessToken: accessToken,
    accessSecret: accessSecret,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, content, scheduledAt, dryRun } = body

    if (action === 'post') {
      // Post a tweet immediately
      if (!content) {
        return NextResponse.json(
          { error: 'Missing tweet content' },
          { status: 400 }
        )
      }

      if (content.length > 280) {
        return NextResponse.json(
          { error: 'Tweet exceeds 280 characters' },
          { status: 400 }
        )
      }

      if (dryRun) {
        // Just validate, don't actually post
        return NextResponse.json({
          success: true,
          dryRun: true,
          content,
          message: 'Tweet validation passed',
        })
      }

      // Post to Twitter
      const client = getTwitterClient()
      const rwClient = client.readWrite

      const tweet = await rwClient.v2.tweet(content)

      return NextResponse.json({
        success: true,
        tweetId: tweet.data.id,
        content,
        postedAt: new Date().toISOString(),
      })
    }

    if (action === 'schedule') {
      // Add tweets to queue
      if (!content || !Array.isArray(content)) {
        return NextResponse.json(
          { error: 'Missing or invalid tweet content array' },
          { status: 400 }
        )
      }

      const scheduler = getTweetScheduler()

      // Create GeneratedTweet objects
      const tweets = content.map((text: string) => ({
        content: text,
        type: 'education' as const,
        createdAt: new Date(),
      }))

      const scheduled = scheduler.addToQueue(tweets, scheduledAt ? new Date(scheduledAt) : undefined)

      return NextResponse.json({
        success: true,
        scheduled: scheduled.length,
        tweets: scheduled.map((t) => ({
          content: t.content,
          scheduledAt: t.scheduledAt.toISOString(),
        })),
      })
    }

    if (action === 'queue-status') {
      // Get current queue status
      const scheduler = getTweetScheduler()
      const stats = scheduler.getStats()
      const queue = scheduler.getQueue()

      return NextResponse.json({
        stats,
        upcomingTweets: queue
          .filter((t) => t.status === 'queued')
          .slice(0, 5)
          .map((t) => ({
            content: t.content,
            scheduledAt: t.scheduledAt.toISOString(),
          })),
      })
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Twitter Post Error]', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to post tweet',
      },
      { status: 500 }
    )
  }
}

// GET to check endpoint status
export async function GET() {
  try {
    const scheduler = getTweetScheduler()
    const stats = scheduler.getStats()

    return NextResponse.json({
      status: 'ok',
      scheduler: stats,
      config: scheduler.getConfig(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Endpoint error',
      },
      { status: 500 }
    )
  }
}
