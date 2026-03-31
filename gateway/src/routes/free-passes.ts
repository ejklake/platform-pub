import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { pool } from '../../shared/src/db/client.js'
import { requireAuth } from '../middleware/auth.js'
import logger from '../../shared/src/lib/logger.js'

// =============================================================================
// Free Pass Routes
//
// POST   /articles/:articleId/free-pass          — grant free access to a user
// DELETE /articles/:articleId/free-pass/:userId   — revoke free access
// GET    /articles/:articleId/free-passes         — list grants (author view)
// =============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const GrantFreePassSchema = z.object({
  recipientId: z.string().regex(UUID_RE),
})

export async function freePassRoutes(app: FastifyInstance) {

  // ---------------------------------------------------------------------------
  // POST /articles/:articleId/free-pass — grant free access to a user
  // ---------------------------------------------------------------------------

  app.post<{ Params: { articleId: string } }>(
    '/articles/:articleId/free-pass',
    { preHandler: requireAuth },
    async (req, reply) => {
      const writerId = req.session!.sub!
      const { articleId } = req.params

      const parsed = GrantFreePassSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() })
      }

      const { recipientId } = parsed.data

      // Verify author owns the article
      const article = await pool.query<{ id: string; title: string }>(
        'SELECT id, title FROM articles WHERE id = $1 AND writer_id = $2 AND deleted_at IS NULL',
        [articleId, writerId]
      )
      if (article.rowCount === 0) {
        return reply.status(404).send({ error: 'Article not found' })
      }

      // Verify recipient exists
      const recipient = await pool.query<{ id: string }>(
        'SELECT id FROM accounts WHERE id = $1',
        [recipientId]
      )
      if (recipient.rowCount === 0) {
        return reply.status(404).send({ error: 'Recipient not found' })
      }

      // Insert access grant — no read_event, no tab charge
      await pool.query(
        `INSERT INTO article_unlocks (reader_id, article_id, unlocked_via)
         VALUES ($1, $2, 'author_grant')
         ON CONFLICT (reader_id, article_id) DO NOTHING`,
        [recipientId, articleId]
      )

      // Insert notification for the recipient
      await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, article_id)
         VALUES ($1, $2, 'free_pass_granted', $3)`,
        [recipientId, writerId, articleId]
      ).catch(err => {
        logger.error({ err, recipientId, articleId }, 'Failed to create free pass notification')
      })

      logger.info(
        { writerId, recipientId, articleId },
        'Free pass granted'
      )

      return reply.status(201).send({ ok: true })
    }
  )

  // ---------------------------------------------------------------------------
  // DELETE /articles/:articleId/free-pass/:userId — revoke free access
  // ---------------------------------------------------------------------------

  app.delete<{ Params: { articleId: string; userId: string } }>(
    '/articles/:articleId/free-pass/:userId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const writerId = req.session!.sub!
      const { articleId, userId } = req.params

      // Verify author owns the article
      const article = await pool.query<{ id: string }>(
        'SELECT id FROM articles WHERE id = $1 AND writer_id = $2 AND deleted_at IS NULL',
        [articleId, writerId]
      )
      if (article.rowCount === 0) {
        return reply.status(404).send({ error: 'Article not found' })
      }

      const result = await pool.query(
        `DELETE FROM article_unlocks
         WHERE reader_id = $1 AND article_id = $2 AND unlocked_via = 'author_grant'`,
        [userId, articleId]
      )

      if (result.rowCount === 0) {
        return reply.status(404).send({ error: 'Free pass not found' })
      }

      logger.info({ writerId, userId, articleId }, 'Free pass revoked')
      return reply.status(200).send({ ok: true })
    }
  )

  // ---------------------------------------------------------------------------
  // GET /articles/:articleId/free-passes — list grants (author view)
  // ---------------------------------------------------------------------------

  app.get<{ Params: { articleId: string } }>(
    '/articles/:articleId/free-passes',
    { preHandler: requireAuth },
    async (req, reply) => {
      const writerId = req.session!.sub!
      const { articleId } = req.params

      // Verify author owns the article
      const article = await pool.query<{ id: string }>(
        'SELECT id FROM articles WHERE id = $1 AND writer_id = $2 AND deleted_at IS NULL',
        [articleId, writerId]
      )
      if (article.rowCount === 0) {
        return reply.status(404).send({ error: 'Article not found' })
      }

      const { rows } = await pool.query<{
        reader_id: string
        username: string | null
        display_name: string | null
        avatar_blossom_url: string | null
        unlocked_at: Date
      }>(
        `SELECT au.reader_id, a.username, a.display_name, a.avatar_blossom_url, au.unlocked_at
         FROM article_unlocks au
         JOIN accounts a ON a.id = au.reader_id
         WHERE au.article_id = $1 AND au.unlocked_via = 'author_grant'
         ORDER BY au.unlocked_at DESC`,
        [articleId]
      )

      return reply.status(200).send({
        passes: rows.map(r => ({
          userId: r.reader_id,
          username: r.username,
          displayName: r.display_name,
          avatar: r.avatar_blossom_url,
          grantedAt: r.unlocked_at.toISOString(),
        })),
      })
    }
  )
}
