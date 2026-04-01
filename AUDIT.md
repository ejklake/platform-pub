# Codebase Audit Report

Generated 2026-04-01.

## Critical

### 1. `schema.sql` is stale — fresh Docker installs break immediately

`schema.sql` is loaded by Docker's `initdb.d` on first boot, but it's frozen at an early state. Tables and columns added by migrations 001–017 are absent: `subscriptions`, `subscription_events`, `article_unlocks`, `notifications`, `votes`, `vote_tallies`, `vote_charges`, `conversations`, `direct_messages`, `pledge_drives`, `pledges`, `dm_pricing`, `magic_links`, plus columns like `subscription_price_pence` and `email` on `accounts`. The DEPLOYMENT.md documents production outages caused by exactly this drift. A `docker compose up` on a fresh checkout will produce a DB that the application code cannot use.

### 2. ~~Payment verification includes provisional reads~~ (Retracted)

Originally reported as a bug. The query in `key-service/src/services/verification.ts:35` includes `'provisional'` in the `IN` clause. The accompanying comments and dead fallback code incorrectly stated that provisional reads should not be valid for key issuance. In fact, provisional reads are real purchases paid from the reader's free £5 starting credit and should grant permanent access. The misleading comments and dead code have been cleaned up.

### 3. `checkAndTriggerDriveFulfilment` uses `FOR UPDATE` outside a transaction

`drives.ts:618-633` — `SELECT ... FOR UPDATE` is issued via the shared `pool` (auto-commit mode). The row lock is released immediately after the SELECT completes, so the subsequent UPDATE is unprotected. A concurrent article publish for the same draft could trigger double fulfilment, creating duplicate `read_events` and double-charging pledgers.

### 4. Gate-pass: payment charged but unlock not recorded atomically

`articles.ts:396-428` — The gate-pass flow calls the payment service (step 2), the key service (step 3), then `recordPurchaseUnlock`. If the process crashes between step 2 and the unlock insert, the reader is charged but has no permanent unlock record. On retry, `checkArticleAccess` won't find an unlock, so the reader is charged again. These should be in the same transaction or the endpoint should be idempotent.

---

## High

### 5. Suspended accounts can still authenticate

The auth middleware (`auth.ts:37-55`) verifies the JWT but never checks if `accounts.status = 'active'`. A suspended user retains their session cookie and can keep making API calls for up to 7 days (the JWT lifetime). `/auth/me` also doesn't check status, so the frontend never knows.

### 6. Settlement confirmation lacks row-level lock — double-debit on webhook replay

`settlement.ts:231-298` — `confirmSettlement` reads the settlement record without `FOR UPDATE`. If Stripe delivers duplicate `payment_intent.succeeded` webhooks (permitted by their SLA), both can subtract the settled amount from the tab, effectively double-debiting the reader.

### 7. DM messages only stored for recipients, not the sender

`messages.ts:317-322` — A `direct_messages` row is created per recipient, but none for the sender. `GET /messages/:conversationId` filters by `dm.recipient_id = $1`, so the sender can never see their own sent messages in a conversation thread.

### 8. Nginx missing all security headers

`nginx.conf` lacks `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`, and `Permissions-Policy` on the HTTPS server block. Only `/media/` has `X-Content-Type-Options: nosniff`. This leaves the application vulnerable to clickjacking, protocol downgrade, and other browser-side attacks.

### 9. No rate limiting on the public-facing gateway

The gateway (the only internet-facing service) has zero rate limiting. Signup, login (magic link email flood), search, gate-pass, voting, and DM sending are all unprotected. The key-service uses `@fastify/rate-limit` internally, but the gateway does not.

### 10. `requireAdmin` doesn't return after sending 403

`moderation.ts:31-38` — After `reply.status(403).send(...)`, the function doesn't `return`. Execution falls through, and the route handler may still run. Should be `return reply.status(403).send(...)`.

### 11. All Docker containers run as root

None of the five Dockerfiles (`gateway/`, `payment-service/`, `key-service/`, `key-custody/`, `web/`) specify a `USER` directive. The `node:20-alpine` base image defaults to root. A container escape or RCE gives root privileges.

### 12. Internal service ports exposed on localhost

`docker-compose.yml` binds payment (3001), key-service (3002), key-custody (3004), and blossom (3003) to `127.0.0.1`. These internal services should not be exposed at all — any process on the host can bypass the gateway's auth middleware and call them directly.

---

## Medium

### 13. No subscription renewal mechanism

Subscriptions are created with a 30-day `current_period_end`, but there's no cron job or worker to renew them. `access.ts:48-52` checks `current_period_end > now()`, so subscriptions silently expire. `expireOverdueDrives` exists for drives but there's no equivalent `renewSubscriptions`.

### 14. `renderMarkdownSync` is an XSS vector

`markdown.ts:85-108` — The synchronous fallback uses regex replacements without sanitization. `[click](javascript:alert(1))` produces a live XSS link. The async `renderMarkdown` is safe (uses `rehype-sanitize`), but `renderMarkdownSync` is exported and available for misuse.

### 15. Search ILIKE not escaped for wildcards

`search.ts:96-97` — User input goes directly into `%${query}%` without escaping LIKE metacharacters (`%`, `_`). Searching for `%` matches all articles; `_` matches single characters. Not a security hole (parameterized queries prevent SQL injection) but produces incorrect results.

### 16. Expired subscriptions block re-subscribing

Migration 005 creates `UNIQUE (reader_id, writer_id)` on `subscriptions`. The code at `subscriptions.ts:61-65` only checks `status IN ('active', 'cancelled')`. Once a subscription expires, the unique constraint prevents creating a new one — the reader can never re-subscribe to that writer.

### 17. `AccrualService` caches platform config permanently

`payment-service/src/services/accrual.ts:19-24` — Config is loaded once into `this.config` and never refreshed. `invalidateConfig()` exists but nothing calls it. Changes to platform fee rate or settlement thresholds require a service restart.

### 18. Notification type mismatch between frontend and backend

The web client's `Notification` type (`api.ts:357-358`) only lists `'new_follower' | 'new_reply' | 'new_subscriber' | 'new_quote' | 'new_mention'`. The backend creates many additional types: `'commission_request'`, `'drive_funded'`, `'pledge_fulfilled'`, `'new_message'`, `'free_pass_granted'`. These are silently unrecognized by the frontend.

### 19. Drive update skips falsy values (can't set amounts to zero)

`drives.ts:225-227` — `if (data.fundingTargetPence)` and `if (data.suggestedPricePence)` use truthiness checks. Since `0` is falsy in JS, these fields can never be set to zero. Should use `!== undefined`.

### 20. Missing health checks on 7 Docker services

Only `postgres` and `strfry` have health checks. Gateway, payment, key-service, key-custody, web, nginx, and blossom have none. Docker Compose cannot detect or auto-restart broken containers.

### 21. Auth hydration race condition in frontend

`AuthProvider.tsx` calls `fetchMe()` in `useEffect`, but children render before it completes. Protected routes see `user === null` during hydration and may redirect to `/auth` even though the user is logged in. The `loading` flag exists but routes check `user` directly.

### 22. Foreign keys in later migrations missing `ON DELETE` clauses

`vote_charges.vote_id`, `vote_charges.voter_id`, `pledges.pledger_id`, `pledge_drives.creator_id`, `pledge_drives.target_writer_id`, `conversations.created_by`, and `dm_pricing` FKs all default to `NO ACTION`. If accounts are ever deleted, these become orphaned references that break joins.

---

## Low

### 23. Hardcoded 30-day subscription period

`30 * 24 * 60 * 60 * 1000` used directly in two places (`subscriptions.ts:74,127`). Should be a named constant; also not exactly one calendar month.

### 24. `payment-service` missing `"type": "module"` in `package.json`

Inconsistent with all other backend services.

### 25. Migrations 009, 016, 017 use `CREATE TABLE` without `IF NOT EXISTS`

Non-idempotent; will fail on re-execution.

### 26. Comment tree building assumes time-ordered input

`replies.ts:252-279` — A child reply with an earlier timestamp than its parent becomes an orphan at the top level.

### 27. `proxyToService` swallows non-JSON upstream responses

`articles.ts:747` — `res.json().catch(() => null)` returns `null` to the client with no useful error context.

### 28. 7-day JWT session lifetime is long for a payment platform

Industry standard for financial services is 1–2 hours with refresh-on-use.

### 29. `votes/tally` endpoint is public and accepts up to 200 IDs via query string

Could exceed URL length limits in some proxies.
