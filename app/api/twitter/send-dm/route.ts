import { NextRequest, NextResponse } from 'next/server'
import { sendTwitterDM } from '@/lib/twitter-service'
import { isBusinessHours, type AutoSendConfig, DEFAULT_AUTO_SEND_CONFIG } from '@/lib/auto-send-scheduler'

export async function POST(request: NextRequest) {
  try {
    const { prospectId, message, recipientUsername, twitterCredentials, config } = await request.json()

    if (!twitterCredentials || !recipientUsername || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const autoSendConfig: AutoSendConfig = config || DEFAULT_AUTO_SEND_CONFIG

    if (!autoSendConfig.enabled) {
      return NextResponse.json(
        { error: 'Auto-send is disabled' },
        { status: 400 }
      )
    }

    if (autoSendConfig.businessHoursOnly && !isBusinessHours(autoSendConfig)) {
      return NextResponse.json(
        { error: 'Outside business hours', nextSendTime: new Date() },
        { status: 400 }
      )
    }

    const result = await sendTwitterDM(twitterCredentials, recipientUsername, message)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send DM' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      prospectId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Send DM Error]', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
