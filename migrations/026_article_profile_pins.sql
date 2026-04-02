-- Migration 026: Article profile pinning
-- Allows writers to pin articles to the top of their profile's Work tab.

ALTER TABLE articles
  ADD COLUMN pinned_on_profile BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN profile_pin_order INTEGER NOT NULL DEFAULT 0;
