'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Filter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getReviewStorageKey, parseReviewState, type ProspectReviewState } from '@/lib/prospect-engine/review-state'
import type { Prospect, ProspectStatus } from '@/lib/prospect-engine/types'
import { ProspectTable } from './prospect-table'

type StatusFilter = ProspectStatus | 'all'
type SortMode = 'score-desc' | 'followers-desc' | 'activity-desc' | 'name-asc'

interface ProspectWorkspaceProps {
  prospects: Prospect[]
  title?: string
  description?: string
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function matchesSearch(prospect: Prospect, query: string) {
  if (!query) {
    return true
  }

  const haystack = [
    prospect.name,
    prospect.githubUsername,
    prospect.email,
    prospect.location,
    prospect.bio,
    prospect.notes,
    ...prospect.scoreReasons,
    ...prospect.repos.flatMap((repo) => [repo.name, repo.description, repo.language, ...repo.matchedKeywords]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function sortProspects(prospects: Prospect[], sortMode: SortMode) {
  return [...prospects].sort((a, b) => {
    if (sortMode === 'followers-desc') {
      return b.followers - a.followers
    }
    if (sortMode === 'activity-desc') {
      return b.recentActivityScore - a.recentActivityScore
    }
    if (sortMode === 'name-asc') {
      return a.name.localeCompare(b.name)
    }
    return b.totalScore - a.totalScore
  })
}

export function ProspectWorkspace({
  prospects,
  title = 'Prospect queue',
  description = 'Search, prioritize, and export the developers worth reviewing next.',
}: ProspectWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [minimumScore, setMinimumScore] = useState(0)
  const [sortMode, setSortMode] = useState<SortMode>('score-desc')
  const [reviewStates, setReviewStates] = useState<Record<string, ProspectReviewState>>({})

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextStates: Record<string, ProspectReviewState> = {}
      for (const prospect of prospects) {
        const savedState = parseReviewState(window.localStorage.getItem(getReviewStorageKey(prospect.id)))
        if (savedState) {
          nextStates[prospect.id] = savedState
        }
      }
      setReviewStates(nextStates)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [prospects])

  const hydratedProspects = useMemo(
    () =>
      prospects.map((prospect) => {
        const reviewState = reviewStates[prospect.id]
        return {
          ...prospect,
          status: reviewState?.status ?? prospect.status,
          notes: reviewState?.notes || prospect.notes,
        }
      }),
    [prospects, reviewStates],
  )

  const filteredProspects = useMemo(() => {
    const filtered = hydratedProspects.filter(
      (prospect) =>
        matchesSearch(prospect, query) &&
        prospect.totalScore >= minimumScore &&
        (statusFilter === 'all' || prospect.status === statusFilter),
    )

    return sortProspects(filtered, sortMode)
  }, [hydratedProspects, minimumScore, query, sortMode, statusFilter])

  const stats = useMemo(() => {
    const approved = hydratedProspects.filter((prospect) => prospect.status === 'approved').length
    const contacted = hydratedProspects.filter((prospect) => prospect.status === 'contacted').length
    const contactable = hydratedProspects.filter((prospect) => Boolean(prospect.email)).length
    const averageScore =
      hydratedProspects.length === 0
        ? 0
        : Math.round(hydratedProspects.reduce((total, prospect) => total + prospect.totalScore, 0) / hydratedProspects.length)

    return {
      approved,
      contacted,
      contactable,
      averageScore,
    }
  }, [hydratedProspects])

  function exportCsv() {
    const header = [
      'name',
      'github_username',
      'github_url',
      'email',
      'repo_count',
      'followers',
      'total_score',
      'status',
      'top_repo',
      'notes',
    ]

    const rows = filteredProspects.map((prospect) => [
      prospect.name,
      prospect.githubUsername,
      prospect.githubUrl,
      prospect.email ?? '',
      prospect.repoCount,
      prospect.followers,
      prospect.totalScore,
      prospect.status,
      prospect.repos[0]?.name ?? '',
      prospect.notes ?? '',
    ])

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `repofuse-prospects-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={filteredProspects.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Avg. score</p>
              <p className="mt-1 text-2xl font-black">{stats.averageScore}</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Public emails</p>
              <p className="mt-1 text-2xl font-black">{stats.contactable}</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="mt-1 text-2xl font-black">{stats.approved}</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Contacted</p>
              <p className="mt-1 text-2xl font-black">{stats.contacted}</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
            <label className="space-y-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Search className="h-3.5 w-3.5" />
                Search
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, username, repo, keyword..."
                className="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Filter className="h-3.5 w-3.5" />
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Minimum score</span>
              <input
                value={minimumScore}
                onChange={(event) => setMinimumScore(Number(event.target.value) || 0)}
                type="number"
                min="0"
                max="100"
                className="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Sort by</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="score-desc">Score</option>
                <option value="followers-desc">Followers</option>
                <option value="activity-desc">Activity</option>
                <option value="name-asc">Name</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Showing {filteredProspects.length} of {hydratedProspects.length} prospects. Review statuses and notes are
            stored locally in this browser.
          </p>
        </CardContent>
      </Card>

      <ProspectTable prospects={filteredProspects} />
    </div>
  )
}
