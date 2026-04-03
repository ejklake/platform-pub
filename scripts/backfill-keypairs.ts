/**
 * Backfill nostr_privkey_enc for accounts that are missing custodial keypairs.
 *
 * Generates a new secp256k1 keypair for each account, encrypts the private key
 * with ACCOUNT_KEY_HEX (same scheme as key-custody), and updates the account's
 * nostr_pubkey + nostr_privkey_enc. This is necessary for NIP-44 key unwrapping
 * to work in the paywall unlock flow.
 *
 * Usage:
 *   ACCOUNT_KEY_HEX=... DATABASE_URL=... npx tsx scripts/backfill-keypairs.ts
 */

import pg from "pg";
import crypto from "node:crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://platformpub:platformpub@localhost:5432/platformpub";
const ACCOUNT_KEY_HEX = process.env.ACCOUNT_KEY_HEX;

if (!ACCOUNT_KEY_HEX) {
  console.error("ACCOUNT_KEY_HEX is required");
  process.exit(1);
}

const accountKey = Buffer.from(ACCOUNT_KEY_HEX, "hex");
if (accountKey.length !== 32) {
  console.error("ACCOUNT_KEY_HEX must be 32 bytes (64 hex chars)");
  process.exit(1);
}

function generateKeypair(): { pubkey: string; privkeyEnc: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
  });

  const jwk = privateKey.export({ format: "jwk" });
  const privBytes = Buffer.from(jwk.d!, "base64url");

  const pubJwk = publicKey.export({ format: "jwk" });
  const xOnlyPubkey = Buffer.from(pubJwk.x!, "base64url");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", accountKey, iv);
  const encrypted = Buffer.concat([cipher.update(privBytes), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const privkeyEnc = Buffer.concat([iv, authTag, encrypted]).toString("base64");

  return { pubkey: xOnlyPubkey.toString("hex"), privkeyEnc };
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE nostr_privkey_enc IS NULL`
    );

    console.log(`Found ${rows.length} accounts missing custodial keypairs.`);
    if (rows.length === 0) return;

    let updated = 0;
    for (const row of rows) {
      const kp = generateKeypair();
      await client.query(
        `UPDATE accounts SET nostr_pubkey = $1, nostr_privkey_enc = $2 WHERE id = $3`,
        [kp.pubkey, kp.privkeyEnc, row.id]
      );
      updated++;
    }

    console.log(`Updated ${updated} accounts with new keypairs.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
