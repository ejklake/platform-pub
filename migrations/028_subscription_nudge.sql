-- 028: Subscription nudge tracking
--
-- Tracks when the spend-threshold subscription nudge has been shown to a
-- reader for a given writer in a given calendar month. Prevents repeated
-- display of the conversion offer.

CREATE TABLE subscription_nudge_log (
  reader_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  writer_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month     DATE NOT NULL,
  shown_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (reader_id, writer_id, month)
);
