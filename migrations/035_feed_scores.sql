-- 035: Feed scores table + scoring weight config
--
-- Pre-computed engagement scores for the ranked feed modes (explore,
-- following_plus, extended). Refreshed by a background worker every 5 minutes
-- using an HN-style gravity formula.

CREATE TABLE feed_scores (
  nostr_event_id  TEXT PRIMARY KEY,
  author_id       UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  content_type    content_type NOT NULL,
  score           FLOAT NOT NULL DEFAULT 0,
  engagement_count INT NOT NULL DEFAULT 0,
  gate_pass_count INT NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ NOT NULL,
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_scores_score ON feed_scores (score DESC);
CREATE INDEX idx_feed_scores_author ON feed_scores (author_id, score DESC);
CREATE INDEX idx_feed_scores_published ON feed_scores (published_at DESC);

-- Scoring weight constants (tunable without deploys)
INSERT INTO platform_config (key, value, description) VALUES
  ('feed_gravity',              '1.5', 'Time-decay exponent for feed scoring (HN-style)'),
  ('feed_weight_reaction',      '1',   'Score weight for reactions'),
  ('feed_weight_reply',         '2',   'Score weight for replies'),
  ('feed_weight_quote_comment', '3',   'Score weight for quote comments'),
  ('feed_weight_gate_pass',     '5',   'Score weight for gate passes (paid reads)')
ON CONFLICT (key) DO NOTHING;
