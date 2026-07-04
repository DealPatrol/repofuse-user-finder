import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/twitter/auth')
}

beforeEach(() => {
  vi.stubEnv('TWITTER_CONSUMER_KEY', '')
  vi.stubEnv('TWITTER_CONSUMER_SECRET', '')
  vi.stubEnv('VERCEL_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/twitter/auth', () => {
  it('returns 500 when Twitter credentials are not configured', async () => {
    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Twitter credentials not configured' })
  })

  it('returns 500 when only the consumer key is set', async () => {
    vi.stubEnv('TWITTER_CONSUMER_KEY', 'key')
    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
  })

  it('returns 500 when only the consumer secret is set', async () => {
    vi.stubEnv('TWITTER_CONSUMER_SECRET', 'secret')
    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
  })

  it('returns an OAuth authUrl built from the consumer key and redirect URI when configured', async () => {
    vi.stubEnv('TWITTER_CONSUMER_KEY', 'my-consumer-key')
    vi.stubEnv('TWITTER_CONSUMER_SECRET', 'my-consumer-secret')

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.authUrl).toContain('https://twitter.com/i/oauth2/authorize')
    expect(body.authUrl).toContain('client_id=my-consumer-key')
    expect(body.authUrl).toContain(encodeURIComponent('http://localhost:3000/api/twitter/callback'))
  })

  it('uses VERCEL_URL for the redirect URI when set', async () => {
    vi.stubEnv('TWITTER_CONSUMER_KEY', 'my-consumer-key')
    vi.stubEnv('TWITTER_CONSUMER_SECRET', 'my-consumer-secret')
    vi.stubEnv('VERCEL_URL', 'my-app.vercel.app')

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(body.authUrl).toContain(encodeURIComponent('my-app.vercel.app/api/twitter/callback'))
  })
})
