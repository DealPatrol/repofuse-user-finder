import { NextRequest, NextResponse } from 'next/server'
import { getFollowStats, getFollows } from '@/lib/follow-service'

export async function GET(request: NextRequest) {
  try {
    const stats = getFollowStats()
    const follows = getFollows()

    // Get pagination parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const paginatedFollows = follows.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      stats,
      follows: paginatedFollows,
      pagination: {
        total: follows.length,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('[Follow Stats API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
