-- =============================================================================
-- Migration 017: Pledge Drives
--
-- Adds:
--   1. drive_status enum (open, funded, published, fulfilled, expired, cancelled)
--   2. drive_origin enum (crowdfund, commission)
--   3. pledge_status enum (active, fulfilled, void)
--   4. pledge_drives table
--   5. pledges table
-- =============================================================================

CREATE TYPE drive_status AS ENUM (
  'open',        -- accepting pledges
  'funded',      -- target reached (still accepting pledges)
  'published',   -- article published, fulfilment pending
  'fulfilled',   -- all pledges processed, access granted
  'expired',     -- deadline passed without publication
  'cancelled'    -- creator deleted the drive
);

CREATE TYPE drive_origin AS ENUM (
  'crowdfund',   -- creator is the writer
  'commission'   -- creator is a reader, target writer is specified
);

CREATE TYPE pledge_status AS ENUM (
  'active',      -- pledge is live, awaiting publication
  'fulfilled',   -- article published, read_event created, access granted
  'void'         -- drive cancelled or expired, pledge is void
);

CREATE TABLE pledge_drives (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID NOT NULL REFERENCES accounts(id),
  origin                drive_origin NOT NULL,
  target_writer_id      UUID NOT NULL REFERENCES accounts(id),  -- same as creator for crowdfunds
  title                 TEXT NOT NULL,
  description           TEXT,
  funding_target_pence  INT,              -- NULL = no target (open-ended amount)
  current_total_pence   INT NOT NULL DEFAULT 0,
  suggested_price_pence INT,              -- suggested per-pledge amount
  status                drive_status NOT NULL DEFAULT 'open',
  article_id            UUID REFERENCES articles(id),
  draft_id              UUID REFERENCES article_drafts(id),
  nostr_event_id        TEXT UNIQUE,      -- replaceable event on relay
  pinned                BOOLEAN NOT NULL DEFAULT TRUE,
  accepted_at           TIMESTAMPTZ,      -- when target writer accepted (commissions)
  deadline              TIMESTAMPTZ,      -- NULL = open-ended
  published_at          TIMESTAMPTZ,
  fulfilled_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drives_creator ON pledge_drives(creator_id);
CREATE INDEX idx_drives_writer ON pledge_drives(target_writer_id);
CREATE INDEX idx_drives_status ON pledge_drives(status);
CREATE INDEX idx_drives_nostr ON pledge_drives(nostr_event_id);

CREATE TABLE pledges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id      UUID NOT NULL REFERENCES pledge_drives(id),
  pledger_id    UUID NOT NULL REFERENCES accounts(id),
  amount_pence  INT NOT NULL,
  status        pledge_status NOT NULL DEFAULT 'active',
  read_event_id UUID REFERENCES read_events(id),  -- populated on fulfilment
  fulfilled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drive_id, pledger_id)  -- one pledge per user per drive
);

CREATE INDEX idx_pledges_drive ON pledges(drive_id);
CREATE INDEX idx_pledges_pledger ON pledges(pledger_id);
CREATE INDEX idx_pledges_status ON pledges(status);

-- Auto-update updated_at on pledge_drives
CREATE TRIGGER trg_pledge_drives_updated_at
  BEFORE UPDATE ON pledge_drives
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
