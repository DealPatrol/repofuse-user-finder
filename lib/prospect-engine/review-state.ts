import type { ProspectStatus } from './types'

export const REVIEW_STORAGE_PREFIX = 'repofuse-user-finder:review:'

export interface ProspectReviewState {
  status: ProspectStatus
  notes: string
  updatedAt: string
}

export function getReviewStorageKey(prospectId: string) {
  return `${REVIEW_STORAGE_PREFIX}${prospectId}`
}

export function parseReviewState(rawValue: string | null): ProspectReviewState | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ProspectReviewState>
    if (!parsed.status || typeof parsed.status !== 'string') {
      return null
    }

    return {
      status: parsed.status as ProspectStatus,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}
