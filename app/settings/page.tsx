'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Check, AlertTriangle, Sparkles, Users, Shield } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'
import { useEffect, useState } from 'react'

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
  
  // Tweet configuration
  const [tweetingEnabled, setTweetingEnabled] = useState(true)
  const [dailyTweetCount, setDailyTweetCount] = useState(3)
  const [tweetBusinessHoursStart, setTweetBusinessHoursStart] = useState(9)
  const [tweetBusinessHoursEnd, setTweetBusinessHoursEnd] = useState(17)
  const [tweetTimezone, setTweetTimezone] = useState('America/New_York')

  // Follow configuration
  const [followEnabled, setFollowEnabled] = useState(true)
  const [maxFollowsPerDay, setMaxFollowsPerDay] = useState(5)
  const [gracePeriodDays, setGracePeriodDays] = useState(7)
  
  // Follow stats
  const { data: followStats } = useSWR('/api/twitter/follow-stats', (url) =>
    fetch(url).then((r) => r.json())
  )
  
  // Safety dashboard
  const { data: safetyData, mutate: refreshSafety } = useSWR('/api/twitter/safety-dashboard', (url) =>
    fetch(url).then((r) => r.json()).catch(() => null)
  )
  
  const [checkingFollowers, setCheckingFollowers] = useState(false)
  const [unfollowingNonFollowers, setUnfollowingNonFollowers] = useState(false)
  const [runningHealthCheck, setRunningHealthCheck] = useState(false)

  async function handleCheckFollowers() {
    setCheckingFollowers(true)
    try {
      const response = await fetch('/api/twitter/check-followers', {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        alert(`Checked follower status for ${data.updated} accounts`)
      }
    } catch (error) {
      alert('Failed to check followers')
    } finally {
      setCheckingFollowers(false)
    }
  }

  async function handleUnfollowNonFollowers() {
    setUnfollowingNonFollowers(true)
    try {
      const response = await fetch('/api/twitter/unfollow-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gracePeriodDays }),
      })
      const data = await response.json()
      if (data.success) {
        alert(`Unfollowed ${data.unfollowed} non-followers`)
      }
    } catch (error) {
      alert('Failed to unfollow')
    } finally {
      setUnfollowingNonFollowers(false)
    }
  }

  async function handleRunHealthCheck() {
    setRunningHealthCheck(true)
    try {
      await refreshSafety()
      alert('Account health check completed')
    } catch (error) {
      alert('Failed to run health check')
    } finally {
      setRunningHealthCheck(false)
    }
  }

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

        {/* Tweet Automation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Auto-Post Tweets
            </CardTitle>
            <CardDescription>Automatically post tweets to grow your X/Twitter audience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable Auto-Tweeting</label>
                <p className="text-sm text-muted-foreground">Post tweets 2-4 times daily with educational insights and discoveries</p>
              </div>
              <button
                onClick={() => setTweetingEnabled(!tweetingEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tweetingEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tweetingEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {tweetingEnabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Daily Tweet Count</label>
                  <select
                    value={dailyTweetCount}
                    onChange={(e) => setDailyTweetCount(parseInt(e.target.value))}
                    className="w-full rounded border bg-background px-3 py-2"
                  >
                    <option value={2}>2 tweets per day</option>
                    <option value={3}>3 tweets per day</option>
                    <option value={4}>4 tweets per day</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Posts spread evenly throughout business hours for natural engagement
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Business Hours (in {tweetTimezone})</label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Start</label>
                      <select
                        value={tweetBusinessHoursStart}
                        onChange={(e) => setTweetBusinessHoursStart(parseInt(e.target.value))}
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
                        value={tweetBusinessHoursEnd}
                        onChange={(e) => setTweetBusinessHoursEnd(parseInt(e.target.value))}
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
                    value={tweetTimezone}
                    onChange={(e) => setTweetTimezone(e.target.value)}
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

                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-900">
                    Phase 1: Building follower base with educational tips, anonymized discoveries, and RepoFuse CTAs. No prospect tagging yet.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Follow/Unfollow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Auto-Follow Growth
            </CardTitle>
            <CardDescription>Automatically follow prospects and unfollow non-followers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable Auto-Follow</label>
                <p className="text-sm text-muted-foreground">Follow prospects from your discovery list</p>
              </div>
              <button
                onClick={() => setFollowEnabled(!followEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  followEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    followEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {followEnabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Follows Per Day</label>
                    <select
                      value={maxFollowsPerDay}
                      onChange={(e) => setMaxFollowsPerDay(parseInt(e.target.value))}
                      className="w-full rounded border bg-background px-3 py-2"
                    >
                      <option value={3}>3 per day</option>
                      <option value={5}>5 per day</option>
                      <option value={7}>7 per day</option>
                      <option value={10}>10 per day</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Respects Twitter API rate limits</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unfollow Grace Period</label>
                    <select
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(parseInt(e.target.value))}
                      className="w-full rounded border bg-background px-3 py-2"
                    >
                      <option value={3}>3 days</option>
                      <option value={5}>5 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Wait before unfollowing non-followers</p>
                  </div>
                </div>

                {followStats && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Total Following</p>
                      <p className="text-2xl font-bold">{followStats.stats?.totalFollowing || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-green-50 p-3">
                      <p className="text-xs text-green-700 font-medium">Following Back</p>
                      <p className="text-2xl font-bold text-green-700">{followStats.stats?.followingBack || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-orange-50 p-3">
                      <p className="text-xs text-orange-700 font-medium">Not Following Back</p>
                      <p className="text-2xl font-bold text-orange-700">{followStats.stats?.notFollowingBack || 0}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleCheckFollowers}
                    disabled={checkingFollowers}
                    variant="outline"
                    className="flex-1"
                  >
                    {checkingFollowers ? 'Checking...' : 'Check Followers'}
                  </Button>
                  <Button
                    onClick={handleUnfollowNonFollowers}
                    disabled={unfollowingNonFollowers}
                    variant="outline"
                    className="flex-1"
                  >
                    {unfollowingNonFollowers ? 'Unfollowing...' : 'Unfollow Non-Followers'}
                  </Button>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-900">
                    Auto-follows {maxFollowsPerDay} prospects daily. Non-followers are checked weekly on Sundays at 10 AM UTC
                    and unfollowed after {gracePeriodDays} days without a follow-back.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Account Safety Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Safety Monitor
            </CardTitle>
            <CardDescription>Real-time monitoring to prevent account suspension</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {safetyData?.dashboard && (
              <>
                {/* Automation Status */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Automation Status</p>
                    {safetyData.dashboard.automationStatus.paused ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        <AlertCircle className="h-3 w-3" />
                        Paused
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        <Check className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </div>
                  {safetyData.dashboard.automationStatus.paused && (
                    <p className="text-sm text-red-600 mb-3">
                      {safetyData.dashboard.automationStatus.pauseReason}
                    </p>
                  )}
                </div>

                {/* Rate Limits */}
                <div>
                  <p className="text-sm font-medium mb-3">Daily Action Usage</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded border bg-card p-3">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs text-muted-foreground">Follows</p>
                        <span className="text-xs font-medium">
                          {safetyData.dashboard.rateLimits.today.follows}/{safetyData.dashboard.rateLimits.limits.maxFollowsPerDay}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded"
                          style={{
                            width: `${Math.min(100, (safetyData.dashboard.rateLimits.today.follows / safetyData.dashboard.rateLimits.limits.maxFollowsPerDay) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded border bg-card p-3">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs text-muted-foreground">Likes</p>
                        <span className="text-xs font-medium">
                          {safetyData.dashboard.rateLimits.today.likes}/{safetyData.dashboard.rateLimits.limits.maxLikesPerHour * 24}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded"
                          style={{
                            width: `${Math.min(100, (safetyData.dashboard.rateLimits.today.likes / (safetyData.dashboard.rateLimits.limits.maxLikesPerHour * 24)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Health */}
                {safetyData.dashboard.accountHealth && (
                  <div>
                    <p className="text-sm font-medium mb-3">Account Health Score</p>
                    <div className="rounded border bg-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold">
                          {safetyData.dashboard.accountHealth.healthScore}/100
                        </span>
                        <span className="text-sm font-medium">
                          {safetyData.dashboard.accountHealth.healthScore >= 70 ? '✓ Healthy' : '⚠ At Risk'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            safetyData.dashboard.accountHealth.healthScore >= 70 ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${safetyData.dashboard.accountHealth.healthScore}%` }}
                        />
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        <p>Followers: {safetyData.dashboard.accountHealth.metrics.followers}</p>
                        <p>Following: {safetyData.dashboard.accountHealth.metrics.following}</p>
                        <p>Follower Ratio: {safetyData.dashboard.accountHealth.metrics.followerRatio.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {safetyData.dashboard.recommendations && safetyData.dashboard.recommendations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recommendations</p>
                    <div className="space-y-2">
                      {safetyData.dashboard.recommendations.map((rec: any, idx: number) => (
                        <div
                          key={idx}
                          className={`rounded p-2 text-sm ${
                            rec.level === 'critical'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : rec.level === 'warning'
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {rec.message}
                          {rec.action && <div className="mt-1 font-medium">{rec.action}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleRunHealthCheck}
                  disabled={runningHealthCheck}
                  variant="outline"
                  className="w-full"
                >
                  {runningHealthCheck ? 'Running Health Check...' : 'Run Health Check Now'}
                </Button>
              </>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                Safety monitoring prevents automated actions that could trigger Twitter rate limits or account warnings.
                All engagement respects hard stop thresholds and includes automatic circuit breaker protection.
              </p>
            </div>
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
