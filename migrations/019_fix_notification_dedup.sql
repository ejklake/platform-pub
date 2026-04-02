-- =============================================================================
-- Migration 019: Fix notification deduplication index
--
-- The old dedup index prevented new notifications from ever being created once
-- a prior notification of the same (recipient, actor, type, targets) existed —
-- even after it was marked read. This meant repeat events (re-follow, second
-- reply from same user, etc.) silently failed to notify.
--
-- Fix: make the unique constraint a partial index on unread notifications only.
-- Once a notification is read, the row no longer occupies the unique slot, so
-- new events of the same kind can insert fresh rows.
-- =============================================================================

DROP INDEX IF EXISTS idx_notifications_dedup;

CREATE UNIQUE INDEX idx_notifications_dedup
  ON notifications (
    recipient_id,
    COALESCE(actor_id, '00000000-0000-0000-0000-000000000000'),
    type,
    COALESCE(article_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(note_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(comment_id, '00000000-0000-0000-0000-000000000000')
  )
  WHERE read = false;
