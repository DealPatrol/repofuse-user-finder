import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET
  const redirectUri = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/twitter/callback`

  if (!consumerKey || !consumerSecret) {
    return NextResponse.json(
      { error: 'Twitter credentials not configured' },
      { status: 500 }
    )
  }

  // Generate OAuth URL (you'll need to implement this with twitter-api-v2)
  // For now, return redirect URL that user can visit
  const authUrl = `https://twitter.com/i/oauth2/authorize?client_id=${consumerKey}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=tweet.read%20tweet.write%20users.read%20follows.read%20follows.write%20offline.access%20mute.read%20mute.write%20like.read%20like.write%20bookmark.read%20bookmark.write%20block.read%20block.write%20dm.read%20dm.write&state=${Math.random().toString(36).substring(7)}`

  return NextResponse.json({ authUrl })
}
