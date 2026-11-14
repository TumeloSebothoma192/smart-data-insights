const crypto = require('crypto');

/**
 * The JWT signing secret. A missing JWT_SECRET used to fall back to a fixed string that is
 * public in this repo, which would let anyone forge login tokens. Production now refuses to
 * start without it; in development a random per-process secret is used (logins reset on restart).
 */
let secret = process.env.JWT_SECRET;
if (!secret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  secret = crypto.randomBytes(48).toString('hex');
  console.warn('JWT_SECRET is not set: using a random development secret (tokens reset on restart).');
}
module.exports = secret;
