-- =============================================================================
-- Migration 010: Votes
--
-- Stores individual vote events for upvoting/downvoting content.
-- Each row is one vote action (not a net tally). The per-user vote count
-- on a given piece of content determines the price of the next vote.
--
-- Content is identified by its Nostr event ID, which is unique across
-- articles, notes, and replies.
-- =============================================================================

CREATE TABLE votes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_nostr_event_id TEXT NOT NULL,
  target_author_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  direction             TEXT NOT NULL CHECK (direction IN ('up', 'down')),

  -- Pricing at time of vote (immutable audit trail)
  sequence_number       INT NOT NULL,      -- this user's nth up/down vote on this content (1-indexed)
  cost_pence            BIGINT NOT NULL DEFAULT 0,  -- 0 for free first upvote; BIGINT for doubling safety

  -- Billing linkage
  tab_id                UUID REFERENCES reading_tabs(id) ON DELETE SET NULL,
  on_free_allowance     BOOLEAN NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_votes_target ON votes(target_nostr_event_id);
CREATE INDEX idx_votes_voter_target ON votes(voter_id, target_nostr_event_id, direction);
CREATE INDEX idx_votes_author ON votes(target_author_id);
CREATE INDEX idx_votes_created ON votes(created_at DESC);

-- =============================================================================
-- Materialised vote tallies for fast display.
-- Updated by the vote API after each insert.
-- =============================================================================

CREATE TABLE vote_tallies (
  target_nostr_event_id TEXT PRIMARY KEY,
  upvote_count          INT NOT NULL DEFAULT 0,
  downvote_count        INT NOT NULL DEFAULT 0,
  net_score             INT NOT NULL DEFAULT 0,  -- upvote_count - downvote_count
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Vote charges — billing records for paid votes.
-- Upvotes: recipient_id = content author (paid out via Stripe Connect).
-- Downvotes: recipient_id IS NULL (platform revenue, not forwarded to writer).
-- =============================================================================

CREATE TABLE vote_charges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id           UUID NOT NULL REFERENCES votes(id),
  voter_id          UUID NOT NULL REFERENCES accounts(id),
  recipient_id      UUID REFERENCES accounts(id),  -- NULL for downvotes (platform revenue)
  amount_pence      BIGINT NOT NULL,
  tab_id            UUID REFERENCES reading_tabs(id) ON DELETE SET NULL,
  on_free_allowance BOOLEAN NOT NULL DEFAULT FALSE,
  state             read_state NOT NULL DEFAULT 'provisional',

  -- Payout linkage (mirrors read_events pattern)
  writer_payout_id  UUID,                          -- FK to writer_payouts; set when writer is paid

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Back-fill FK on vote_charges once writer_payouts exists (already defined above)
ALTER TABLE vote_charges
  ADD CONSTRAINT fk_vote_charges_writer_payout
  FOREIGN KEY (writer_payout_id) REFERENCES writer_payouts (id) ON DELETE SET NULL;

CREATE INDEX idx_vote_charges_vote_id ON vote_charges(vote_id);
CREATE INDEX idx_vote_charges_voter_id ON vote_charges(voter_id);
CREATE INDEX idx_vote_charges_recipient_id ON vote_charges(recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX idx_vote_charges_state ON vote_charges(state);
CREATE INDEX idx_vote_charges_tab_id ON vote_charges(tab_id) WHERE tab_id IS NOT NULL;
