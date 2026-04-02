import { KIND_NOTE } from './ndk'
import { signAndPublish } from './sign'

// =============================================================================
// Note Publishing Service
//
// Publishes a short-form note (Nostr kind 1) via the gateway.
// No direct relay access needed — signing and publishing happen server-side.
// =============================================================================

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? ''

interface PublishNoteResult {
  noteEventId: string
}

export interface QuoteTarget {
  eventId: string
  eventKind: number
  authorPubkey: string
  previewTitle?: string
  previewContent?: string
  previewAuthorName?: string
  highlightedText?: string
}

export async function publishNote(
  content: string,
  authorPubkey: string,
  quoteTarget?: QuoteTarget
): Promise<PublishNoteResult> {
  const tags: string[][] = []

  // Add q tag for quote-notes (NIP-18)
  if (quoteTarget) {
    tags.push(['q', quoteTarget.eventId, '', quoteTarget.authorPubkey])
    if (quoteTarget.highlightedText) {
      const words = quoteTarget.highlightedText.trim().split(/\s+/).slice(0, 80).join(' ')
      tags.push(['excerpt', words])
      if (quoteTarget.previewTitle) tags.push(['excerpt-title', quoteTarget.previewTitle])
      if (quoteTarget.previewAuthorName) tags.push(['excerpt-author', quoteTarget.previewAuthorName])
    }
  }

  // Sign and publish via gateway
  const signed = await signAndPublish({
    kind: KIND_NOTE,
    content,
    tags,
  })

  // Index in platform DB
  await indexNote({
    nostrEventId: signed.id,
    content,
    ...(quoteTarget && {
      isQuoteComment: true,
      quotedEventId: quoteTarget.eventId,
      quotedEventKind: quoteTarget.eventKind,
      quotedExcerpt: quoteTarget.highlightedText,
      quotedTitle: quoteTarget.previewTitle,
      quotedAuthor: quoteTarget.previewAuthorName,
    }),
  })

  return { noteEventId: signed.id }
}

async function indexNote(params: {
  nostrEventId: string
  content: string
  isQuoteComment?: boolean
  quotedEventId?: string
  quotedEventKind?: number
  quotedExcerpt?: string
  quotedTitle?: string
  quotedAuthor?: string
}): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/notes`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    console.error('Note indexing failed:', res.status)
  }
}
