'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Check, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface TwitterConfig {
  connected: boolean
  username?: string
  lastConnected?: string
}

export default function SettingsPage() {
  const [twitterConfig, setTwitterConfig] = useState<TwitterConfig>({
    connected: false,
  })
  const [autoSendEnabled, setAutoSendEnabled] = useState(true)
  const [businessHoursStart, setBusinessHoursStart] = useState(9)
  const [businessHoursEnd, setBusinessHoursEnd] = useState(17)
  const [timezone, setTimezone] = useState('America/New_York')
  const [connecting, setConnecting] = useState(false)

  async function handleTwitterConnect() {
    setConnecting(true)
    try {
      const response = await fetch('/api/twitter/auth')
      const data = await response.json()

      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (error) {
      console.error('Failed to connect Twitter:', error)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href="/prospects" className="text-sm text-muted-foreground hover:underline">
            ← Back to prospects
          </Link>
          <h1 className="mt-4 text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-muted-foreground">Configure auto-send and Twitter integration</p>
        </div>

        {/* Twitter Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 002.856-3.915v-2.768h-2.204a3.993 3.993 0 00-3.638 2.025 3.99 3.99 0 00-6.94 3.657V5.03h-2.201v3.897h-3.86V5.03H2.97v3.897H0v2.7h2.97v4.83c0 3.34 2.04 5.14 5 5.14 1.46 0 2.7-.34 2.7-.34v-2.946c0 .034-.03.068-.09.068-.33 0-1.12.23-1.95.23-2.73 0-3.55-1.64-3.55-3.37v-3.77h3.55v2.7h2.205v-2.7h3.02v4.83c0 3.34 2.04 5.14 5 5.14 1.46 0 2.7-.34 2.7-.34v-2.946a1.86 1.86 0 01-.09.068c-.33 0-1.12.23-1.95.23-2.73 0-3.55-1.64-3.55-3.37v-3.77h3.55v2.7h2.205v-2.7h3.02v4.83c0 3.34 2.04 5.14 5 5.14 1.46 0 2.7-.34 2.7-.34v-2.946a1.86 1.86 0 01-.09.068" />
              </svg>
              Twitter/X Integration
            </CardTitle>
            <CardDescription>Connect your Twitter account to enable auto-sending DMs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {twitterConfig.connected ? (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Connected</p>
                    <p className="text-sm text-green-700">{twitterConfig.username}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setTwitterConfig({ connected: false })}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <p className="text-yellow-900">Twitter account not connected</p>
                </div>
                <Button onClick={handleTwitterConnect} disabled={connecting}>
                  {connecting ? 'Connecting...' : 'Connect Twitter'}
                </Button>
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium">Required OAuth Scopes</p>
                  <p>dm.write, dm.read, users.read, tweet.read</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Send Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Auto-Send Configuration</CardTitle>
            <CardDescription>Configure when and how messages are sent automatically</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable Auto-Send</label>
                <p className="text-sm text-muted-foreground">Automatically send DMs to approved prospects</p>
              </div>
              <button
                onClick={() => setAutoSendEnabled(!autoSendEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoSendEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSendEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {autoSendEnabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Business Hours (in {timezone})</label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Start</label>
                      <select
                        value={businessHoursStart}
                        onChange={(e) => setBusinessHoursStart(parseInt(e.target.value))}
                        className="mt-1 w-full rounded border bg-background px-3 py-2"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i.toString().padStart(2, '0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">End</label>
                      <select
                        value={businessHoursEnd}
                        onChange={(e) => setBusinessHoursEnd(parseInt(e.target.value))}
                        className="mt-1 w-full rounded border bg-background px-3 py-2"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i.toString().padStart(2, '0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded border bg-background px-3 py-2"
                  >
                    <option>America/New_York</option>
                    <option>America/Chicago</option>
                    <option>America/Denver</option>
                    <option>America/Los_Angeles</option>
                    <option>Europe/London</option>
                    <option>Europe/Paris</option>
                    <option>Asia/Tokyo</option>
                    <option>Asia/Singapore</option>
                  </select>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-900">
                    Messages approved outside business hours will be queued and sent at{' '}
                    <strong>
                      {businessHoursStart}:00 {timezone}
                    </strong>
                    .
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button className="w-full" size="lg">
          Save Settings
        </Button>
      </div>
    </main>
  )
}
