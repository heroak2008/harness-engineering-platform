import crypto from 'crypto';

// A random secret generated once per process start. It is intentionally
// non-deterministic and never written to disk, so it cannot be relied upon
// across restarts and must never be treated as a real production secret.
// It only exists so the app can still boot locally for demos/tests without
// requiring configuration up front.
const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString('hex');

let hasWarned = false;

/**
 * Returns the JWT signing secret.
 * - In production, JWT_SECRET must be set via environment variables; the
 *   server refuses to sign/verify tokens otherwise.
 * - In development/test, falls back to a random, process-lifetime-only
 *   secret so the app is runnable out of the box, with a console warning.
 */
export function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production. Set it in your .env file before starting the server.'
    );
  }

  if (!hasWarned) {
    console.warn(
      '[auth] JWT_SECRET is not set. Using a randomly generated, process-lifetime-only secret for development. ' +
      'Existing tokens will become invalid on restart. Set JWT_SECRET in your .env file for a stable/production setup.'
    );
    hasWarned = true;
  }

  return EPHEMERAL_DEV_SECRET;
}
