-- 030: Commissions expansion
--
-- Adds conversational threading to pledge drives (commissions from reply
-- contexts), commission button visibility toggle for authors, and
-- acceptance terms for the commission acceptance flow.

-- Thread commissions back to the note that spawned them
ALTER TABLE pledge_drives ADD COLUMN parent_note_event_id TEXT;
CREATE INDEX idx_drives_parent_note ON pledge_drives(parent_note_event_id)
  WHERE parent_note_event_id IS NOT NULL;

-- Let authors hide the commission button on their profile
ALTER TABLE accounts ADD COLUMN show_commission_button BOOLEAN NOT NULL DEFAULT TRUE;

-- Acceptance terms recorded when a writer accepts a commission
ALTER TABLE pledge_drives ADD COLUMN acceptance_terms TEXT;
ALTER TABLE pledge_drives ADD COLUMN backer_access_mode TEXT
  CHECK (backer_access_mode IN ('free', 'paywalled')) DEFAULT 'free';
