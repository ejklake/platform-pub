import { KIND_NOTE } from './ndk'
import { signAndPublish } from './sign'

// =============================================================================
// Comment Publishing Service
//
// Publishes a comment as a Nostr kind 1 event via the gateway, then indexes.
// =============================================================================

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? ''

interface PublishCommentParams {
  content: string
  targetEventId: string
  targetKind: number
  targetAuthorPubkey: string
  parentCommentId?: string
  parentCommentEventId?: string
}

interface PublishCommentResult {
  commentEventId: string
  commentId: string
}

export async function publishComment(params: PublishCommentParams): Promise<PublishCommentResult> {
  const tags: string[][] = [
    ['e', params.targetEventId, '', 'root'],
    ['p', params.targetAuthorPubkey],
  ]

  if (params.parentCommentEventId) {
    tags.push(['e', params.parentCommentEventId, '', 'reply'])
  }

  const signed = await signAndPublish({
    kind: KIND_NOTE,
    content: params.content,
    tags,
  })

  const indexResult = await indexComment({
    nostrEventId: signed.id,
    targetEventId: params.targetEventId,
    targetKind: params.targetKind,
    parentCommentId: params.parentCommentId ?? null,
    content: params.content,
  })

  return {
    commentEventId: signed.id,
    commentId: indexResult.commentId,
  }
}

async function indexComment(params: {
  nostrEventId: string
  targetEventId: string
  targetKind: number
  parentCommentId: string | null
  content: string
}): Promise<{ commentId: string }> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/comments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(`Comment indexing failed: ${res.status} — ${body?.error ?? 'unknown'}`)
  }

  const data = await res.json()
  return { commentId: data.commentId ?? data.id ?? '' }
}
