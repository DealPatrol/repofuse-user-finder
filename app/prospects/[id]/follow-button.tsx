'use client'

import { useState } from 'react'
import { Twitter } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FollowButtonProps {
  githubUsername: string
  twitterHandle?: string
}

export function FollowButton({ githubUsername, twitterHandle }: FollowButtonProps) {
  const [loading, setLoading] = useState(false)
  const [followed, setFollowed] = useState(false)

  if (!twitterHandle) {
    return null
  }

  async function handleFollow() {
    setLoading(true)
    try {
      const response = await fetch('/api/twitter/follow-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospects: [
            {
              twitterHandle: twitterHandle,
              githubUsername: githubUsername,
            },
          ],
        }),
      })

      const data = await response.json()
      if (data.success && data.totalFollowed > 0) {
        setFollowed(true)
      }
    } catch (error) {
      console.error('Failed to follow:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t pt-4">
      <Button
        onClick={handleFollow}
        disabled={loading || followed}
        variant={followed ? 'outline' : 'default'}
        size="sm"
        className="w-full gap-2"
      >
        <Twitter className="h-4 w-4" />
        {followed ? 'Following' : 'Follow on Twitter'}
      </Button>
    </div>
  )
}
