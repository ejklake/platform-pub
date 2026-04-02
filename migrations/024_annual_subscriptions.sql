-- Migration 024: Annual subscription support
-- Adds subscription period tracking and writer-configurable annual discount.

ALTER TABLE subscriptions ADD COLUMN subscription_period TEXT NOT NULL DEFAULT 'monthly'
  CHECK (subscription_period IN ('monthly', 'annual'));

ALTER TABLE accounts ADD COLUMN annual_discount_pct INTEGER NOT NULL DEFAULT 15
  CHECK (annual_discount_pct BETWEEN 0 AND 30);
