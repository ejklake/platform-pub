import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../../shared/src/db/client.js'
import logger from '../../shared/src/lib/logger.js'

// =============================================================================
// Traffology routes — proxies to traffology-ingest for live reader counts
//
// These routes are authenticated: only writers can see their own data.
// =============================================================================

const INGEST_URL = process.env.TRAFFOLOGY_INGEST_URL ?? 'http://localhost:3005'

export async function traffologyRoutes(app: FastifyInstance) {
  // GET /traffology/concurrent/:pieceId — live reader count for a single piece
  app.get<{ Params: { pieceId: string } }>(
    '/traffology/concurrent/:pieceId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { pieceId } = req.params
      const writerId = (req as any).session?.sub

      // Verify the writer owns this piece
      const { rows } = await pool.query(
        'SELECT 1 FROM traffology.pieces WHERE id = $1 AND writer_id = $2',
        [pieceId, writerId],
      )
      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Piece not found' })
      }

      try {
        const res = await fetch(`${INGEST_URL}/concurrent/${pieceId}`)
        if (!res.ok) {
          return reply.status(502).send({ error: 'Ingest service unavailable' })
        }
        return reply.send(await res.json())
      } catch (err) {
        logger.error({ err }, 'Failed to query traffology-ingest')
        return reply.status(502).send({ error: 'Ingest service unavailable' })
      }
    },
  )

  // GET /traffology/concurrent — live counts for all pieces by the authenticated writer
  app.get(
    '/traffology/concurrent',
    { preHandler: requireAuth },
    async (req, reply) => {
      const writerId = (req as any).session?.sub

      try {
        const res = await fetch(`${INGEST_URL}/concurrent/writer/${writerId}`)
        if (!res.ok) {
          return reply.status(502).send({ error: 'Ingest service unavailable' })
        }
        return reply.send(await res.json())
      } catch (err) {
        logger.error({ err }, 'Failed to query traffology-ingest')
        return reply.status(502).send({ error: 'Ingest service unavailable' })
      }
    },
  )
}
