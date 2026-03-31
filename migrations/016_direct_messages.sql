-- =============================================================================
-- Migration 016: Direct Messages
--
-- Adds:
--   1. conversations — multi-party DM threads
--   2. conversation_members — membership join table
--   3. direct_messages — E2E encrypted message content (NIP-44)
--   4. dm_pricing — per-user DM pricing rules (anti-spam)
-- =============================================================================

-- Conversations
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID NOT NULL REFERENCES accounts(id),
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversation membership
CREATE TABLE conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conv_members_user ON conversation_members(user_id);

-- Direct messages (E2E encrypted — one row per recipient with their ciphertext)
CREATE TABLE direct_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  recipient_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  content_enc      TEXT NOT NULL,  -- NIP-44 encrypted to recipient's pubkey
  nostr_event_id   TEXT UNIQUE,    -- NIP-17 gift-wrapped event, published async
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_conversation ON direct_messages(conversation_id, created_at DESC);
CREATE INDEX idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX idx_dm_recipient ON direct_messages(recipient_id);

-- DM pricing (anti-spam: users set a price others must pay to DM them)
CREATE TABLE dm_pricing (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES accounts(id),
  target_id     UUID REFERENCES accounts(id),  -- NULL = default rate for all senders
  price_pence   INT NOT NULL,                   -- 0 = free, >0 = pay to DM
  UNIQUE (owner_id, target_id)
);

-- Ensure only one default rate per owner (target_id IS NULL)
CREATE UNIQUE INDEX idx_dm_pricing_default ON dm_pricing(owner_id) WHERE target_id IS NULL;
