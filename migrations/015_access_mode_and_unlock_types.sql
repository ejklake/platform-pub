-- =============================================================================
-- Migration 015: Replace is_paywalled with access_mode + expand article_unlocks
--
-- Adds:
--   1. access_mode column on articles ('public' | 'paywalled' | 'invitation_only')
--   2. Migrates is_paywalled data into access_mode
--   3. Replaces paywalled_has_price constraint with access_mode_price
--   4. Drops is_paywalled column
--   5. Expands article_unlocks unlocked_via CHECK to include new grant types
-- =============================================================================

-- 1. Add access_mode column with default
ALTER TABLE articles ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'public';

-- 2. Migrate existing data
UPDATE articles SET access_mode = CASE
  WHEN is_paywalled = TRUE THEN 'paywalled'
  ELSE 'public'
END;

-- 3. Replace constraints
ALTER TABLE articles DROP CONSTRAINT IF EXISTS paywalled_has_price;
ALTER TABLE articles ADD CONSTRAINT access_mode_price CHECK (
  (access_mode = 'public') OR
  (access_mode = 'paywalled' AND price_pence IS NOT NULL) OR
  (access_mode = 'invitation_only')
);

-- 4. Drop old column
ALTER TABLE articles DROP COLUMN is_paywalled;

-- 5. Create article_unlocks if missing, then expand unlocked_via
CREATE TABLE IF NOT EXISTS article_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_id UUID NOT NULL REFERENCES accounts(id),
  article_id UUID NOT NULL REFERENCES articles(id),
  unlocked_via TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (reader_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_article_unlocks_reader ON article_unlocks(reader_id);
CREATE INDEX IF NOT EXISTS idx_article_unlocks_article ON article_unlocks(article_id);

ALTER TABLE article_unlocks
  DROP CONSTRAINT IF EXISTS article_unlocks_unlocked_via_check,
  ADD CONSTRAINT article_unlocks_unlocked_via_check
    CHECK (unlocked_via IN (
      'purchase', 'subscription', 'own_content', 'free_allowance',
      'author_grant', 'pledge', 'invitation'
    ));
