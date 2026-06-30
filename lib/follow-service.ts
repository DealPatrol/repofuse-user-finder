import { TwitterApi } from 'twitter-api-v2'
import fs from 'fs'
import path from 'path'

export interface FollowRecord {
  twitterHandle: string
  githubUsername: string
  followedAt: string
  followingBack: boolean
  lastCheckedAt: string
}

interface FollowsData {
  follows: FollowRecord[]
}

const FOLLOWS_FILE = path.join(process.cwd(), 'data', 'follows.json')

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

// Load follows data
function loadFollows(): FollowsData {
  ensureDataDir()
  try {
    if (fs.existsSync(FOLLOWS_FILE)) {
      const data = fs.readFileSync(FOLLOWS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('[Follow Service] Error loading follows:', error)
  }
  return { follows: [] }
}

// Save follows data
function saveFollows(data: FollowsData) {
  ensureDataDir()
  try {
    fs.writeFileSync(FOLLOWS_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('[Follow Service] Error saving follows:', error)
  }
}

interface TwitterCredentials {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessSecret: string
}

export async function followUser(
  credentials: TwitterCredentials,
  twitterHandle: string,
  githubUsername: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new TwitterApi({
      appKey: credentials.consumerKey,
      appSecret: credentials.consumerSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    })

    const rwClient = client.readWrite

    // Get user ID from handle
    const user = await rwClient.v2.userByUsername(twitterHandle)
    if (!user.data?.id) {
      return { success: false, error: 'User not found' }
    }

    // Follow the user using v1.1 API
    await rwClient.v1.post('friendships/create', {
      user_id: user.data.id,
    })

    // Record the follow
    const data = loadFollows()
    const existingIndex = data.follows.findIndex((f) => f.twitterHandle === twitterHandle)

    if (existingIndex >= 0) {
      data.follows[existingIndex] = {
        twitterHandle,
        githubUsername,
        followedAt: data.follows[existingIndex].followedAt,
        followingBack: false,
        lastCheckedAt: new Date().toISOString(),
      }
    } else {
      data.follows.push({
        twitterHandle,
        githubUsername,
        followedAt: new Date().toISOString(),
        followingBack: false,
        lastCheckedAt: new Date().toISOString(),
      })
    }

    saveFollows(data)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Follow Service] Error following user:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function checkFollowerStatus(
  credentials: TwitterCredentials
): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    const client = new TwitterApi({
      appKey: credentials.consumerKey,
      appSecret: credentials.consumerSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    })

    const rwClient = client.readWrite

    // Get authenticated user ID
    const me = await rwClient.v2.me()
    if (!me.data?.id) {
      return { success: false, updated: 0, error: 'Failed to get authenticated user' }
    }

    const data = loadFollows()
    let updated = 0

    // Check followers for each follow
    for (const follow of data.follows) {
      try {
        // Get user by handle
        const user = await rwClient.v2.userByUsername(follow.twitterHandle)
        if (!user.data?.id) continue

        // Check if they follow us back by checking our followers
        const followers = await rwClient.v2.followers(me.data.id, {
          max_results: 100,
        })

        follow.followingBack = followers.data?.some((f) => f.id === user.data.id) ?? false
        follow.lastCheckedAt = new Date().toISOString()
        updated++

        // Rate limit - wait 1 second between checks
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`[Follow Service] Error checking ${follow.twitterHandle}:`, error)
      }
    }

    saveFollows(data)
    return { success: true, updated }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Follow Service] Error checking followers:', errorMessage)
    return { success: false, updated: 0, error: errorMessage }
  }
}

export async function unfollowNonFollowers(
  credentials: TwitterCredentials,
  gracePeriodDays: number = 7
): Promise<{ success: boolean; unfollowed: number; error?: string }> {
  try {
    const client = new TwitterApi({
      appKey: credentials.consumerKey,
      appSecret: credentials.consumerSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    })

    const rwClient = client.readWrite
    const data = loadFollows()
    let unfollowed = 0

    const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000
    const now = Date.now()

    for (const follow of data.follows) {
      try {
        const followedAtMs = new Date(follow.followedAt).getTime()
        const daysSinceFollow = (now - followedAtMs) / (24 * 60 * 60 * 1000)

        // Only unfollow if past grace period and not following back
        if (daysSinceFollow >= gracePeriodDays && !follow.followingBack) {
          // Get user ID
          const user = await rwClient.v2.userByUsername(follow.twitterHandle)
          if (user.data?.id) {
            await rwClient.v1.post('friendships/destroy', {
              user_id: user.data.id,
            })
            unfollowed++

            // Remove from tracking
            const index = data.follows.indexOf(follow)
            if (index > -1) {
              data.follows.splice(index, 1)
            }

            // Rate limit - wait 2 seconds between unfollows
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }
      } catch (error) {
        console.error(`[Follow Service] Error unfollowing ${follow.twitterHandle}:`, error)
      }
    }

    saveFollows(data)
    return { success: true, unfollowed }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Follow Service] Error unfollowing:', errorMessage)
    return { success: false, unfollowed: 0, error: errorMessage }
  }
}

export function getFollowStats(): {
  totalFollowing: number
  followingBack: number
  notFollowingBack: number
} {
  const data = loadFollows()
  const followingBack = data.follows.filter((f) => f.followingBack).length
  const notFollowingBack = data.follows.filter((f) => !f.followingBack).length

  return {
    totalFollowing: data.follows.length,
    followingBack,
    notFollowingBack,
  }
}

export function getFollows(): FollowRecord[] {
  const data = loadFollows()
  return data.follows
}
