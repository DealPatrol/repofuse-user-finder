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
    if (!user.data) {
      return { success: false, error: 'User not found' }
    }

    // Send DM
    const dm = await rwClient.v1.sendDm({
      recipient_id: user.data.id,
      text: message,
    })

    return {
      success: true,
      messageId: dm.event.id,
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
  redirectUri: string
): string {
  const client = new TwitterApi({
    appKey: consumerKey,
    appSecret: '', // Not needed for URL generation
  })

  return client.generateAuthLink(redirectUri, {
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
  })[0]
}
