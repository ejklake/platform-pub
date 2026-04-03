-- 029: Capped gift links
--
-- Shareable URLs that grant free access to paywalled articles, with a
-- configurable redemption limit (default 5).

CREATE TABLE gift_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  creator_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token             TEXT NOT NULL UNIQUE,
  max_redemptions   INT NOT NULL DEFAULT 5,
  redemption_count  INT NOT NULL DEFAULT 0,
  revoked_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gift_links_token ON gift_links(token);
CREATE INDEX idx_gift_links_article ON gift_links(article_id);
