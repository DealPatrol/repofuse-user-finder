import { NextRequest, NextResponse } from 'next/server'
import { checkFollowerStatus } from '@/lib/follow-service'

export async function POST(request: NextRequest) {
  try {
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

    const result = await checkFollowerStatus(credentials)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to check followers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      message: `Checked ${result.updated} followers`,
    })
  } catch (error) {
    console.error('[Check Followers API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
