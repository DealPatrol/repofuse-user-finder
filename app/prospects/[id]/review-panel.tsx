'use client'

import { useState } from 'react'
import { CheckCircle2, Clipboard, Mail, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProspectStatus } from '@/lib/prospect-engine/types'

interface ReviewPanelProps {
  initialStatus: ProspectStatus
  subject: string
  body: string
  prospectUsername?: string
  onAutoSend?: (message: string) => Promise<void>
  autoSendEnabled?: boolean
}

export function ReviewPanel({ 
  initialStatus, 
  subject, 
  body, 
  prospectUsername,
  onAutoSend,
  autoSendEnabled = true 
}: ReviewPanelProps) {
  const [status, setStatus] = useState<ProspectStatus>(initialStatus)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)

  async function copyMessage() {
    const message = `Subject: ${subject}\n\n${body}`

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  async function handleAutoSend() {
    if (!onAutoSend) return
    
    setSending(true)
    try {
      await onAutoSend(body)
      setStatus('contacted')
    } catch (error) {
      console.error('Auto-send failed:', error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
        <p className="mt-1 text-lg font-semibold capitalize">{status}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" onClick={() => setStatus('approved')} className="justify-start">
          <CheckCircle2 className="h-4 w-4" />
          Approve draft
        </Button>
        
        {autoSendEnabled && onAutoSend && (
          <Button 
            type="button" 
            onClick={handleAutoSend}
            disabled={sending}
            className="justify-start"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Auto-send to Twitter'}
          </Button>
        )}
        
        <Button type="button" variant="secondary" onClick={() => setStatus('contacted')} className="justify-start">
          <Mail className="h-4 w-4" />
          Mark contacted
        </Button>
        
        <Button type="button" variant="outline" onClick={copyMessage} className="justify-start">
          <Clipboard className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy message'}
        </Button>
        
        <Button type="button" variant="destructive" onClick={() => setStatus('rejected')} className="justify-start">
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {autoSendEnabled 
          ? 'Auto-send respects business hours (9 AM - 5 PM ET). Messages scheduled during off-hours will send at the next business window.'
          : 'Use Copy Message to manually reach out after reviewing the prospect.'}
      </p>
    </div>
  )
}
