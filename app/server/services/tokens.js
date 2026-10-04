const db = require('../db');
const { encrypt, decrypt } = require('./encryption');
const twitch = require('./twitch');

/* -------------------------------------------------------
   Get a fresh access token for a user record, refreshing
   (and persisting) it if expired.
   Record must include user_id, access_token, refresh_token,
   token_expires_at.
   ------------------------------------------------------- */
async function getFreshToken(record) {
  const expiresAt = new Date(record.token_expires_at);

  if (expiresAt > new Date()) {
    return decrypt(record.access_token);
  }

  const refreshToken = decrypt(record.refresh_token);
  const tokens = await twitch.refreshAccessToken(refreshToken);
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await db.query(
    `UPDATE users SET
       access_token = $1, refresh_token = $2,
       token_expires_at = $3, updated_at = NOW()
     WHERE id = $4`,
    [
      encrypt(tokens.access_token),
      encrypt(tokens.refresh_token),
      newExpiry.toISOString(),
      record.user_id,
    ]
  );

  return tokens.access_token;
}

module.exports = { getFreshToken };
