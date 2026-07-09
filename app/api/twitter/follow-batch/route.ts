import { NextRequest, NextResponse } from 'next/server'
import { followUser } from '@/lib/follow-service'

interface FollowRequest {
  prospects: Array<{
    twitterHandle: string
    githubUsername: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: FollowRequest = await request.json()

    if (!body.prospects || !Array.isArray(body.prospects)) {
      return NextResponse.json(
        { error: 'Invalid request: prospects array required' },
        { status: 400 }
      )
    }

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

    const results = []

    // Follow each prospect with delays to avoid rate limiting
    for (const prospect of body.prospects) {
      try {
        const result = await followUser(
          credentials,
          prospect.twitterHandle,
          prospect.githubUsername
        )

        results.push({
          twitterHandle: prospect.twitterHandle,
          success: result.success,
          error: result.error,
        })

        // Wait 3 seconds between follows to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error) {
        results.push({
          twitterHandle: prospect.twitterHandle,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      totalFollowed: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      results,
    })
  } catch (error) {
    console.error('[Follow Batch API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
