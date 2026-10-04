require('dotenv').config();

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: required('APP_URL'),
  sessionSecret: required('SESSION_SECRET'),
  databaseUrl: required('DATABASE_URL'),
  encryptionKey: required('ENCRYPTION_KEY'),

  twitch: {
    clientId: required('TWITCH_CLIENT_ID'),
    clientSecret: required('TWITCH_CLIENT_SECRET'),
    redirectUri: `${required('APP_URL')}/auth/twitch/callback`,
    scopes: [
      'moderator:read:followers',
      'channel:read:subscriptions',
      'bits:read',
    ].join(' '),
  },

  /* Twitch Extension (optional — /ext routes are disabled without these).
     These come from the Extension's own settings page, not the OAuth app. */
  extension: {
    clientId: process.env.TWITCH_EXTENSION_CLIENT_ID || null,
    secret: process.env.TWITCH_EXTENSION_SECRET || null, /* base64, as shown by Twitch */
  },
};
