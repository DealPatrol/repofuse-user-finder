import { checkFollowerStatus, unfollowNonFollowers } from './follow-service'

interface TwitterCredentials {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessSecret: string
}

// Check if we should run the weekly unfollow
function shouldRunUnfollowCheck(): boolean {
  const now = new Date()
  // Run on Sundays at 10 AM UTC
  const isUnday = now.getUTCDay() === 0
  const hour = now.getUTCHours()
  return isUnday && hour === 10
}

// Get next scheduled unfollow check time
function getNextUnfollowCheckTime(): Date {
  const now = new Date()
  const nextCheck = new Date(now)

  // Move to next Sunday
  const daysUntilSunday = (7 - now.getUTCDay()) % 7
  nextCheck.setUTCDate(nextCheck.getUTCDate() + (daysUntilSunday || 7))

  // Set to 10 AM UTC
  nextCheck.setUTCHours(10, 0, 0, 0)

  return nextCheck
}

export async function runWeeklyUnfollowCheck(
  credentials: TwitterCredentials
): Promise<{
  success: boolean
  checkResult?: { success: boolean; updated: number }
  unfollowResult?: { success: boolean; unfollowed: number }
  error?: string
}> {
  try {
    console.log('[Unfollow Scheduler] Starting weekly unfollow check...')

    // First, check follower status for all follows
    const checkResult = await checkFollowerStatus(credentials)
    if (!checkResult.success) {
      return {
        success: false,
        error: `Failed to check followers: ${checkResult.error}`,
      }
    }

    console.log(`[Unfollow Scheduler] Checked ${checkResult.updated} followers`)

    // Then, unfollow non-followers past grace period (7 days)
    const unfollowResult = await unfollowNonFollowers(credentials, 7)
    if (!unfollowResult.success) {
      return {
        success: false,
        error: `Failed to unfollow: ${unfollowResult.error}`,
      }
    }

    console.log(
      `[Unfollow Scheduler] Unfollowed ${unfollowResult.unfollowed} non-followers`
    )

    return {
      success: true,
      checkResult: {
        success: checkResult.success,
        updated: checkResult.updated,
      },
      unfollowResult: {
        success: unfollowResult.success,
        unfollowed: unfollowResult.unfollowed,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Unfollow Scheduler] Error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export { shouldRunUnfollowCheck, getNextUnfollowCheckTime }
