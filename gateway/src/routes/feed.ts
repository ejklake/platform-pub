import type { FastifyInstance } from 'fastify'
import { pool } from '../../shared/src/db/client.js'
import { requireAuth } from '../middleware/auth.js'
import logger from '../../shared/src/lib/logger.js'

// =============================================================================
// Feed
//
// GET /feed?reach=following|explore&cursor=<unix_seconds>&limit=20
//
// Single endpoint with a "reach" dial:
//   following — chronological feed from followed authors (+ own content)
//   explore   — platform-wide trending, scored by engagement velocity
//
// Blocks and mutes are excluded at every level.
// =============================================================================

type Reach = 'following' | 'explore'

const VALID_REACH = new Set<Reach>(['following', 'explore'])
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

// Shared SELECT columns for articles
const ARTICLE_COLS = `
  a.nostr_event_id, a.nostr_d_tag, a.title, a.summary, a.content_free,
  a.access_mode, a.price_pence, a.gate_position_pct,
  EXTRACT(EPOCH FROM a.published_at)::bigint AS published_at,
  acc.nostr_pubkey
`

// Shared SELECT columns for notes
const NOTE_COLS = `
  n.nostr_event_id, n.content, n.is_quote_comment,
  n.quoted_event_id, n.quoted_event_kind,
  n.quoted_excerpt, n.quoted_title, n.quoted_author,
  EXTRACT(EPOCH FROM n.published_at)::bigint AS published_at,
  acc.nostr_pubkey
`

function articleToItem(row: any) {
  return {
    type: 'article' as const,
    nostrEventId: row.nostr_event_id,
    pubkey: row.nostr_pubkey,
    dTag: row.nostr_d_tag,
    title: row.title,
    summary: row.summary ?? '',
    contentFree: row.content_free ?? '',
    accessMode: row.access_mode,
    isPaywalled: row.access_mode === 'paywalled',
    pricePence: row.price_pence ?? undefined,
    gatePositionPct: row.gate_position_pct ?? undefined,
    publishedAt: Number(row.published_at),
    score: row.score != null ? Number(row.score) : undefined,
  }
}

function noteToItem(row: any) {
  return {
    type: 'note' as const,
    nostrEventId: row.nostr_event_id,
    pubkey: row.nostr_pubkey,
    content: row.content,
    isQuoteComment: row.is_quote_comment,
    quotedEventId: row.quoted_event_id ?? undefined,
    quotedEventKind: row.quoted_event_kind ?? undefined,
    quotedExcerpt: row.quoted_excerpt ?? undefined,
    quotedTitle: row.quoted_title ?? undefined,
    quotedAuthor: row.quoted_author ?? undefined,
    publishedAt: Number(row.published_at),
    score: row.score != null ? Number(row.score) : undefined,
  }
}

// Block + mute exclusion subqueries (parameterised on reader ID)
const BLOCK_FILTER = (col: string, paramIdx: number) =>
  `${col} NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $${paramIdx})`
const MUTE_FILTER = (col: string, paramIdx: number) =>
  `${col} NOT IN (SELECT muted_id FROM mutes WHERE muter_id = $${paramIdx})`

export async function feedRoutes(app: FastifyInstance) {

  app.get<{ Querystring: { reach?: string; cursor?: string; limit?: string } }>(
    '/feed', { preHandler: requireAuth }, async (req, reply) => {
    const readerId = req.session!.sub!
    const reach = (req.query.reach ?? 'following') as Reach
    const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined
    const limit = Math.min(parseInt(req.query.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT)

    if (!VALID_REACH.has(reach)) {
      return reply.status(400).send({ error: `Invalid reach: ${reach}. Must be one of: ${[...VALID_REACH].join(', ')}` })
    }

    try {
      const items = reach === 'following'
        ? await followingFeed(readerId, cursor, limit)
        : await exploreFeed(readerId, cursor, limit)

      return reply.send({ items, reach })
    } catch (err) {
      logger.error({ err, reach }, 'Feed fetch failed')
      return reply.status(500).send({ error: 'Feed fetch failed' })
    }
  })
}

// =============================================================================
// following — pure chronological from followed authors + own content
// =============================================================================

async function followingFeed(readerId: string, cursor: number | undefined, limit: number) {
  const cursorClause = cursor ? `AND EXTRACT(EPOCH FROM a.published_at)::bigint < $3` : ''
  const noteCursorClause = cursor ? `AND EXTRACT(EPOCH FROM n.published_at)::bigint < $3` : ''
  const params: any[] = cursor ? [readerId, limit, cursor] : [readerId, limit]

  const [articlesRes, notesRes] = await Promise.all([
    pool.query(`
      SELECT ${ARTICLE_COLS}
      FROM articles a
      JOIN accounts acc ON acc.id = a.writer_id
      WHERE a.deleted_at IS NULL
        AND a.published_at IS NOT NULL
        AND (a.writer_id IN (SELECT followee_id FROM follows WHERE follower_id = $1) OR a.writer_id = $1)
        AND ${BLOCK_FILTER('a.writer_id', 1)}
        AND ${MUTE_FILTER('a.writer_id', 1)}
        ${cursorClause}
      ORDER BY a.published_at DESC
      LIMIT $2
    `, params),
    pool.query(`
      SELECT ${NOTE_COLS}
      FROM notes n
      JOIN accounts acc ON acc.id = n.author_id
      WHERE n.reply_to_event_id IS NULL
        AND (n.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1) OR n.author_id = $1)
        AND ${BLOCK_FILTER('n.author_id', 1)}
        AND ${MUTE_FILTER('n.author_id', 1)}
        ${noteCursorClause}
      ORDER BY n.published_at DESC
      LIMIT $2
    `, params),
  ])

  const items = [
    ...articlesRes.rows.map(articleToItem),
    ...notesRes.rows.map(noteToItem),
  ]
  items.sort((a, b) => b.publishedAt - a.publishedAt)
  return items.slice(0, limit)
}

// =============================================================================
// explore — platform-wide, ranked by engagement score
// =============================================================================

async function exploreFeed(readerId: string, cursor: number | undefined, limit: number) {
  // Score-based cursor: items with score < cursor value
  const cursorClause = cursor ? `AND fs.score < $3` : ''
  const params: any[] = cursor ? [readerId, limit, cursor] : [readerId, limit]

  const { rows } = await pool.query(`
    SELECT
      fs.nostr_event_id, fs.content_type, fs.score, fs.published_at,
      CASE WHEN fs.content_type = 'article' THEN a.nostr_d_tag END AS nostr_d_tag,
      CASE WHEN fs.content_type = 'article' THEN a.title END AS title,
      CASE WHEN fs.content_type = 'article' THEN a.summary END AS summary,
      CASE WHEN fs.content_type = 'article' THEN a.content_free END AS content_free,
      CASE WHEN fs.content_type = 'article' THEN a.access_mode END AS access_mode,
      CASE WHEN fs.content_type = 'article' THEN a.price_pence END AS price_pence,
      CASE WHEN fs.content_type = 'article' THEN a.gate_position_pct END AS gate_position_pct,
      CASE WHEN fs.content_type = 'note' THEN n.content END AS content,
      CASE WHEN fs.content_type = 'note' THEN n.is_quote_comment END AS is_quote_comment,
      CASE WHEN fs.content_type = 'note' THEN n.quoted_event_id END AS quoted_event_id,
      CASE WHEN fs.content_type = 'note' THEN n.quoted_event_kind END AS quoted_event_kind,
      CASE WHEN fs.content_type = 'note' THEN n.quoted_excerpt END AS quoted_excerpt,
      CASE WHEN fs.content_type = 'note' THEN n.quoted_title END AS quoted_title,
      CASE WHEN fs.content_type = 'note' THEN n.quoted_author END AS quoted_author,
      acc.nostr_pubkey,
      EXTRACT(EPOCH FROM fs.published_at)::bigint AS published_at_epoch
    FROM feed_scores fs
    LEFT JOIN articles a ON a.nostr_event_id = fs.nostr_event_id AND fs.content_type = 'article'
    LEFT JOIN notes n ON n.nostr_event_id = fs.nostr_event_id AND fs.content_type = 'note'
    JOIN accounts acc ON acc.id = fs.author_id
    WHERE fs.published_at > now() - interval '48 hours'
      AND ${BLOCK_FILTER('fs.author_id', 1)}
      AND ${MUTE_FILTER('fs.author_id', 1)}
      ${cursorClause}
    ORDER BY fs.score DESC
    LIMIT $2
  `, params)

  return rows.map(row => {
    // Normalise published_at to the epoch column
    const base = { ...row, published_at: row.published_at_epoch }
    return row.content_type === 'article' ? articleToItem(base) : noteToItem(base)
  })
}
