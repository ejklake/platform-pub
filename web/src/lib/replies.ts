import { KIND_NOTE } from './ndk'
import { signAndPublish } from './sign'

// =============================================================================
// Reply Publishing Service
//
// Publishes a reply as a Nostr kind 1 event via the gateway, then indexes.
// =============================================================================

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? ''

interface PublishReplyParams {
  content: string
  targetEventId: string
  targetKind: number
  targetAuthorPubkey: string
  parentCommentId?: string
  parentCommentEventId?: string
}

interface PublishReplyResult {
  replyEventId: string
  replyId: string
}

export async function publishReply(params: PublishReplyParams): Promise<PublishReplyResult> {
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

  const indexResult = await indexReply({
    nostrEventId: signed.id,
    targetEventId: params.targetEventId,
    targetKind: params.targetKind,
    parentCommentId: params.parentCommentId ?? null,
    content: params.content,
  })

  return {
    replyEventId: signed.id,
    replyId: indexResult.replyId,
  }
}

async function indexReply(params: {
  nostrEventId: string
  targetEventId: string
  targetKind: number
  parentCommentId: string | null
  content: string
}): Promise<{ replyId: string }> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/replies`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(`Reply indexing failed: ${res.status} — ${body?.error ?? 'unknown'}`)
  }

  const data = await res.json()
  return { replyId: data.commentId ?? data.id ?? '' }
}
