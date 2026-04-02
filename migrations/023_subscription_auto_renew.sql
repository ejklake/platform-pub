-- Migration 023: Add auto_renew flag to subscriptions
-- Enables automatic renewal instead of silent expiry after 30 days.

ALTER TABLE subscriptions ADD COLUMN auto_renew BOOLEAN NOT NULL DEFAULT TRUE;

-- Existing cancelled subscriptions should not auto-renew
UPDATE subscriptions SET auto_renew = FALSE WHERE status = 'cancelled';
