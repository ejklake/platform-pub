-- Migration 031: Fix media URLs after domain rename (platform.pub → all.haus)
--
-- All images uploaded before the domain rename have blossom_url values
-- pointing at https://platform.pub/media/... which no longer resolves.
-- Update them to https://all.haus/media/...

UPDATE media_uploads
SET blossom_url = REPLACE(blossom_url, 'https://platform.pub/media/', 'https://all.haus/media/')
WHERE blossom_url LIKE 'https://platform.pub/media/%';

UPDATE accounts
SET avatar_blossom_url = REPLACE(avatar_blossom_url, 'https://platform.pub/media/', 'https://all.haus/media/')
WHERE avatar_blossom_url LIKE 'https://platform.pub/media/%';
