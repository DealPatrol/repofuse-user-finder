import { TwitterApi } from 'twitter-api-v2'

export interface TwitterCredentials {
  accessToken: string
  accessSecret: string
  consumerKey: string
  consumerSecret: string
}

export async function sendTwitterDM(
  credentials: TwitterCredentials,
  recipientUsername: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const client = new TwitterApi({
      appKey: credentials.consumerKey,
      appSecret: credentials.consumerSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    })

    const rwClient = client.readWrite

    // Get user ID from username
    const user = await rwClient.v2.userByUsername(recipientUsername)
    if (!user.data?.id) {
      return { success: false, error: 'User not found' }
    }

    // Send DM via raw v1.1 endpoint - this is the most reliable method
    const dm = await rwClient.v1.post('direct_messages/events/new', {
      type: 'message_create',
      message_create: {
        target: {
          recipient_id: user.data.id,
        },
        message_data: {
          text: message,
        },
      },
    } as any)

    return {
      success: true,
      messageId: dm.event?.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Twitter DM Error]', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export function getTwitterOAuthUrl(
  consumerKey: string,
  consumerSecret: string,
  redirectUri: string
): string {
  // Build OAuth 1.0a auth link
  const baseUrl = 'https://twitter.com/i/oauth2/authorize'
  const params = new URLSearchParams({
    client_id: consumerKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'tweet.read tweet.write users.read follows.read follows.write mute.read mute.write',
    state: 'state',
  })
  return `${baseUrl}?${params.toString()}`
}
