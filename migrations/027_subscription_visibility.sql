-- Migration 027: Subscription visibility
-- Allows readers to hide individual subscriptions from their public profile.

ALTER TABLE subscriptions
  ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
