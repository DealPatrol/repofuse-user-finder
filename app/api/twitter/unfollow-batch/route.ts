import { NextRequest, NextResponse } from 'next/server'
import { unfollowNonFollowers } from '@/lib/follow-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const gracePeriodDays = body.gracePeriodDays || 7

    // Get Twitter credentials from environment
    const credentials = {
      consumerKey: process.env.TWITTER_CONSUMER_KEY || '',
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET || '',
      accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
      accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
    }

    if (!credentials.consumerKey) {
      return NextResponse.json(
        { error: 'Twitter credentials not configured' },
        { status: 401 }
      )
    }

    const result = await unfollowNonFollowers(credentials, gracePeriodDays)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unfollow' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      unfollowed: result.unfollowed,
      message: `Unfollowed ${result.unfollowed} non-followers`,
    })
  } catch (error) {
    console.error('[Unfollow Batch API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
