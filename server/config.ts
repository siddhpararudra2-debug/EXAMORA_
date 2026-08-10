import dotenv from 'dotenv';
import crypto from 'crypto';

// Ensure .env is loaded before reading process.env — this module can be
// imported transitively (via server/app.ts) before server.ts's own
// dotenv.config() runs. dotenv.config() is idempotent, so a second call
// elsewhere is harmless.
dotenv.config();

const NODE_ENV = process.env.NODE_ENV ?? 'development';

/**
 * Resolves the JWT signing/verification secret exactly once at import time.
 *
 * - Set JWT_SECRET → used as-is.
 * - Unset in production → throws: a missing secret is a hard misconfiguration,
 *   and a known fallback would silently weaken auth.
 * - Unset in dev/test → loud warning + a random per-boot secret, so local
 *   development works without a config file but sessions do not survive a
 *   restart (tokens signed with a fixed 'dev-secret' are trivially forgeable).
 */
function resolveJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET;

  if (configuredSecret) {
    return configuredSecret;
  }

  if (NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is required when NODE_ENV=production. ' +
        'Set it via environment variables before starting the server.',
    );
  }

  return 'dev-secret-key-not-for-production';
}

export const JWT_SECRET = resolveJwtSecret();
