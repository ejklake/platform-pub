import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { generateKeypair, signEvent, unwrapKey, nip44Encrypt, nip44Decrypt } from '../lib/crypto.js'
import logger from '../lib/logger.js'

// =============================================================================
// Keypair Routes — internal only
//
// All endpoints require the X-Internal-Secret header. They are not exposed
// to the public internet — the gateway calls them on behalf of authenticated
// users.
//
// POST /api/v1/keypairs/generate   — generate a keypair for a new account
// POST /api/v1/keypairs/sign       — sign a Nostr event for an account
// POST /api/v1/keypairs/unwrap     — unwrap a NIP-44 content key for a reader
// =============================================================================

function requireInternalSecret(req: any, reply: any, done: () => void) {
  const secret = process.env.INTERNAL_SECRET
  if (!secret) {
    reply.status(503).send({ error: 'Service misconfigured' })
    return
  }
  // Normalize header to string — Fastify can return string[] for duplicate headers
  const header = req.headers['x-internal-secret']
  const provided = Array.isArray(header) ? header[0] : header
  if (typeof provided !== 'string' || provided !== secret) {
    reply.status(401).send({ error: 'Unauthorized' })
    return
  }
  done()
}

const SignEventSchema = z.object({
  accountId: z.string().uuid(),
  event: z.object({
    kind: z.number().int(),
    content: z.string(),
    tags: z.array(z.array(z.string())),
    created_at: z.number().int().optional(),
  }),
})

const UnwrapKeySchema = z.object({
  accountId: z.string().uuid(),
  encryptedKey: z.string().min(1),
})

const HEX64_RE = /^[0-9a-f]{64}$/

const Nip44EncryptSchema = z.object({
  accountId: z.string().uuid(),
  recipientPubkey: z.string().regex(HEX64_RE),
  plaintext: z.string().min(1),
})

const Nip44DecryptSchema = z.object({
  accountId: z.string().uuid(),
  senderPubkey: z.string().regex(HEX64_RE),
  ciphertext: z.string().min(1),
})

export async function keypairRoutes(app: FastifyInstance) {

  // ---------------------------------------------------------------------------
  // POST /api/v1/keypairs/generate
  //
  // Generates a new Nostr keypair. Returns the public key and the
  // encrypted private key for storage in the accounts table.
  // ---------------------------------------------------------------------------

  app.post('/keypairs/generate', { preHandler: requireInternalSecret }, async (_req, reply) => {
    try {
      const keypair = generateKeypair()
      return reply.status(201).send(keypair)
    } catch (err) {
      logger.error({ err }, 'Keypair generation failed')
      return reply.status(500).send({ error: 'Keypair generation failed' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /api/v1/keypairs/sign
  //
  // Signs a Nostr event template with the account's custodial private key.
  // ---------------------------------------------------------------------------

  app.post('/keypairs/sign', { preHandler: requireInternalSecret }, async (req, reply) => {
    const parsed = SignEventSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    const { accountId, event } = parsed.data

    try {
      const eventTemplate = {
        kind: event.kind,
        content: event.content,
        tags: event.tags,
        created_at: event.created_at ?? Math.floor(Date.now() / 1000),
      }

      const signed = await signEvent(accountId, eventTemplate)

      logger.info({ accountId, eventKind: event.kind, eventId: signed.id }, 'Event signed')

      return reply.status(200).send({
        id: signed.id,
        pubkey: signed.pubkey,
        sig: signed.sig,
        kind: signed.kind,
        content: signed.content,
        tags: signed.tags,
        created_at: signed.created_at,
      })
    } catch (err) {
      logger.error({ err, accountId }, 'Event signing failed')
      return reply.status(500).send({ error: 'Signing failed' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /api/v1/keypairs/unwrap
  //
  // Decrypts a NIP-44 wrapped content key using the reader's private key.
  // The key-service wrapped the content key to the reader's pubkey; this
  // reverses that using the reader's custodial private key.
  // ---------------------------------------------------------------------------

  app.post('/keypairs/unwrap', { preHandler: requireInternalSecret }, async (req, reply) => {
    const parsed = UnwrapKeySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    const { accountId, encryptedKey } = parsed.data

    try {
      const contentKeyBase64 = await unwrapKey(accountId, encryptedKey)

      logger.debug({ accountId }, 'Content key unwrapped for reader')

      return reply.status(200).send({ contentKeyBase64 })
    } catch (err) {
      logger.error({ err, accountId }, 'Key unwrapping failed')
      return reply.status(500).send({ error: 'Key unwrapping failed' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /api/v1/keypairs/nip44-encrypt
  //
  // NIP-44 encrypt plaintext using the account's private key and a recipient
  // public key. Used by the gateway for DM E2E encryption.
  // ---------------------------------------------------------------------------

  app.post('/keypairs/nip44-encrypt', { preHandler: requireInternalSecret }, async (req, reply) => {
    const parsed = Nip44EncryptSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    const { accountId, recipientPubkey, plaintext } = parsed.data

    try {
      const ciphertext = await nip44Encrypt(accountId, recipientPubkey, plaintext)
      logger.debug({ accountId }, 'NIP-44 encrypted for DM')
      return reply.status(200).send({ ciphertext })
    } catch (err) {
      logger.error({ err, accountId }, 'NIP-44 encryption failed')
      return reply.status(500).send({ error: 'Encryption failed' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /api/v1/keypairs/nip44-decrypt
  //
  // NIP-44 decrypt ciphertext using the account's private key and the sender's
  // public key. Used by the gateway for DM E2E decryption.
  // ---------------------------------------------------------------------------

  app.post('/keypairs/nip44-decrypt', { preHandler: requireInternalSecret }, async (req, reply) => {
    const parsed = Nip44DecryptSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    const { accountId, senderPubkey, ciphertext } = parsed.data

    try {
      const plaintext = await nip44Decrypt(accountId, senderPubkey, ciphertext)
      logger.debug({ accountId }, 'NIP-44 decrypted for DM')
      return reply.status(200).send({ plaintext })
    } catch (err) {
      logger.error({ err, accountId }, 'NIP-44 decryption failed')
      return reply.status(500).send({ error: 'Decryption failed' })
    }
  })
}
