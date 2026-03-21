-- =============================================================================
-- Migration 008: Deduplicate articles and enforce one live row per d-tag
--
-- Root cause: POST /articles used ON CONFLICT (nostr_event_id), but every
-- publish/edit produces a new Nostr event with a new ID, so the conflict
-- clause never fired. Each edit inserted a new row instead of updating the
-- existing one, leaving old rows with deleted_at IS NULL that caused deleted
-- articles to reappear after a feed refresh.
--
-- Fix:
--   1. Soft-delete all but the newest live row per (writer_id, nostr_d_tag).
--   2. Add a partial unique index on (writer_id, nostr_d_tag) WHERE
--      deleted_at IS NULL — the gateway then upserts on this constraint.
--
-- The partial index (not a full unique constraint) intentionally allows
-- multiple deleted rows with the same d-tag and lets a writer re-publish
-- an article with the same slug after deleting it.
-- =============================================================================

-- Step 1: Soft-delete duplicate live rows, keeping the newest per writer+d-tag.
-- "Newest" = latest published_at; ties broken by latest created_at.
UPDATE articles
SET deleted_at = now()
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY writer_id, nostr_d_tag
             ORDER BY published_at DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM articles
    WHERE deleted_at IS NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Create the partial unique index.
CREATE UNIQUE INDEX idx_articles_unique_live
  ON articles (writer_id, nostr_d_tag)
  WHERE deleted_at IS NULL;
