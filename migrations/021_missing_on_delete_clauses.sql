-- Migration 021: Add missing ON DELETE clauses
--
-- Tables missed by migration 018. These FKs currently have no ON DELETE clause,
-- meaning account or article deletion would fail with a FK violation rather than
-- cascading or restricting intentionally.

-- subscriptions: reader/writer deletion should cascade (subscription is meaningless without both)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_reader_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_reader_id_fkey
  FOREIGN KEY (reader_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_writer_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_writer_id_fkey
  FOREIGN KEY (writer_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- subscription_events: audit log — cascade with account deletion
ALTER TABLE subscription_events DROP CONSTRAINT IF EXISTS subscription_events_reader_id_fkey;
ALTER TABLE subscription_events ADD CONSTRAINT subscription_events_reader_id_fkey
  FOREIGN KEY (reader_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE subscription_events DROP CONSTRAINT IF EXISTS subscription_events_writer_id_fkey;
ALTER TABLE subscription_events ADD CONSTRAINT subscription_events_writer_id_fkey
  FOREIGN KEY (writer_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- article_unlocks: cascade on both reader and article deletion
ALTER TABLE article_unlocks DROP CONSTRAINT IF EXISTS article_unlocks_reader_id_fkey;
ALTER TABLE article_unlocks ADD CONSTRAINT article_unlocks_reader_id_fkey
  FOREIGN KEY (reader_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE article_unlocks DROP CONSTRAINT IF EXISTS article_unlocks_article_id_fkey;
ALTER TABLE article_unlocks ADD CONSTRAINT article_unlocks_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;

ALTER TABLE article_unlocks DROP CONSTRAINT IF EXISTS article_unlocks_subscription_id_fkey;
ALTER TABLE article_unlocks ADD CONSTRAINT article_unlocks_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

-- vote_charges: cascade on vote deletion, restrict on account deletion (financial record)
ALTER TABLE vote_charges DROP CONSTRAINT IF EXISTS vote_charges_vote_id_fkey;
ALTER TABLE vote_charges ADD CONSTRAINT vote_charges_vote_id_fkey
  FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE;

ALTER TABLE vote_charges DROP CONSTRAINT IF EXISTS vote_charges_voter_id_fkey;
ALTER TABLE vote_charges ADD CONSTRAINT vote_charges_voter_id_fkey
  FOREIGN KEY (voter_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE vote_charges DROP CONSTRAINT IF EXISTS vote_charges_recipient_id_fkey;
ALTER TABLE vote_charges ADD CONSTRAINT vote_charges_recipient_id_fkey
  FOREIGN KEY (recipient_id) REFERENCES accounts(id) ON DELETE RESTRICT;

-- pledges: cascade on pledger deletion
ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_pledger_id_fkey;
ALTER TABLE pledges ADD CONSTRAINT pledges_pledger_id_fkey
  FOREIGN KEY (pledger_id) REFERENCES accounts(id) ON DELETE CASCADE;
