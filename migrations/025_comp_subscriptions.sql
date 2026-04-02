-- Migration 025: Comp (complimentary) subscriptions
-- Writers can grant free subscriptions to readers.

ALTER TABLE subscriptions ADD COLUMN is_comp BOOLEAN NOT NULL DEFAULT FALSE;
