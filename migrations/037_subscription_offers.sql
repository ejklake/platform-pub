-- Subscription offers: flexible discount codes and gifted subscriptions for writers
CREATE TABLE subscription_offers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('code', 'grant')),
  discount_pct      INTEGER NOT NULL CHECK (discount_pct BETWEEN 0 AND 100),
  duration_months   INTEGER,
  code              TEXT UNIQUE,
  recipient_id      UUID REFERENCES accounts(id),
  max_redemptions   INTEGER,
  redemption_count  INTEGER NOT NULL DEFAULT 0,
  expires_at        TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_offers_writer ON subscription_offers(writer_id);
CREATE INDEX idx_sub_offers_code ON subscription_offers(code) WHERE code IS NOT NULL;
CREATE INDEX idx_sub_offers_recipient ON subscription_offers(recipient_id) WHERE recipient_id IS NOT NULL;

-- Track which offer a subscription was created with, and how many discounted periods remain
ALTER TABLE subscriptions
  ADD COLUMN offer_id UUID REFERENCES subscription_offers(id),
  ADD COLUMN offer_periods_remaining INTEGER;
