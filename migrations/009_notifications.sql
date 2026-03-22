-- =============================================================================
-- Migration 009: Notifications table
--
-- Stores in-app notifications for events like new followers and new replies.
-- Actor is nullable so notifications survive if the actor's account is deleted.
-- Article/comment FKs cascade so notifications clean up with their content.
-- =============================================================================

CREATE TABLE notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor_id      UUID        REFERENCES accounts(id) ON DELETE SET NULL,
  type          TEXT        NOT NULL,  -- 'new_follower' | 'new_reply'
  article_id    UUID        REFERENCES articles(id) ON DELETE CASCADE,
  comment_id    UUID        REFERENCES comments(id) ON DELETE CASCADE,
  read          BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
