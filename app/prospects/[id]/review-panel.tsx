'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clipboard, MailCheck, Save, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getReviewStorageKey, parseReviewState, type ProspectReviewState } from '@/lib/prospect-engine/review-state'
import type { ProspectStatus } from '@/lib/prospect-engine/types'

interface ReviewPanelProps {
  prospectId: string
  initialStatus: ProspectStatus
  initialNotes: string | null
  subject: string
  body: string
}

export function ReviewPanel({ prospectId, initialStatus, initialNotes, subject, body }: ReviewPanelProps) {
  const [status, setStatus] = useState<ProspectStatus>(initialStatus)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedState = parseReviewState(window.localStorage.getItem(getReviewStorageKey(prospectId)))
      if (savedState) {
        setStatus(savedState.status)
        setNotes(savedState.notes)
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [prospectId])

  function persistReview(nextState: ProspectReviewState) {
    window.localStorage.setItem(getReviewStorageKey(prospectId), JSON.stringify(nextState))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  function updateStatus(nextStatus: ProspectStatus) {
    setStatus(nextStatus)
    persistReview({
      status: nextStatus,
      notes,
      updatedAt: new Date().toISOString(),
    })
  }

  function saveNotes() {
    persistReview({
      status,
      notes,
      updatedAt: new Date().toISOString(),
    })
  }

  async function copyMessage() {
    const message = `Subject: ${subject}\n\n${body}`

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual review status</p>
        <p className="mt-1 text-lg font-semibold capitalize">{status}</p>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Set status</span>
        <select
          value={status}
          onChange={(event) => updateStatus(event.target.value as ProspectStatus)}
          className="w-full rounded-md border bg-background px-3 py-2"
        >
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="approved">Approved</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" onClick={() => updateStatus('approved')} className="justify-start">
          <CheckCircle2 className="h-4 w-4" />
          Approve draft
        </Button>
        <Button type="button" variant="secondary" onClick={() => updateStatus('contacted')} className="justify-start">
          <MailCheck className="h-4 w-4" />
          Mark contacted
        </Button>
        <Button type="button" variant="outline" onClick={copyMessage} className="justify-start">
          <Clipboard className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy message'}
        </Button>
        <Button type="button" variant="destructive" onClick={() => updateStatus('rejected')} className="justify-start">
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>

      <label className="block space-y-2 text-sm">
        <span className="font-medium">Private review notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What makes this lead worth contacting? What should the first message mention?"
          rows={4}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <Button type="button" variant="outline" onClick={saveNotes} className="w-full justify-start">
        <Save className="h-4 w-4" />
        {saved ? 'Saved locally' : 'Save notes locally'}
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        Status and notes are stored only in this browser. This app never sends messages automatically; copy only after
        manually reviewing the prospect and confirming the contact channel is appropriate.
      </p>
    </div>
  )
}
