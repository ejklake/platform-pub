-- Add reply-to support for direct messages
ALTER TABLE direct_messages
  ADD COLUMN reply_to_id UUID REFERENCES direct_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_dm_reply_to ON direct_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
