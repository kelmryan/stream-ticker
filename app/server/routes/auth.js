const { Router } = require('express');
const crypto = require('crypto');
const twitch = require('../services/twitch');
const { encrypt } = require('../services/encryption');
const db = require('../db');

const router = Router();

/* -------------------------------------------------------
   GET /auth/twitch
   Redirect user to Twitch OAuth consent screen
   ------------------------------------------------------- */
router.get('/twitch', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).send('Session error');
    }
    console.log('Session saved with state:', state);
    res.redirect(twitch.buildAuthorizeUrl(state));
  });
});

/* -------------------------------------------------------
   GET /auth/twitch/callback
   Exchange code for tokens, upsert user, create session
   ------------------------------------------------------- */
router.get('/twitch/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('Callback hit. State:', state, 'Session state:', req.session.oauthState);

    if (!state || state !== req.session.oauthState) {
      return res.status(403).send('Invalid OAuth state');
    }
    delete req.session.oauthState;

    const tokens = await twitch.exchangeCode(code);
    const user = await twitch.getUser(tokens.access_token);

    if (!user) {
      return res.status(400).send('Could not fetch Twitch user');
    }

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    /* Upsert user */
    const { rows } = await db.query(
      `INSERT INTO users
         (twitch_id, twitch_login, twitch_display, twitch_avatar,
          access_token, refresh_token, token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (twitch_id) DO UPDATE SET
         twitch_login     = EXCLUDED.twitch_login,
         twitch_display   = EXCLUDED.twitch_display,
         twitch_avatar    = EXCLUDED.twitch_avatar,
         access_token     = EXCLUDED.access_token,
         refresh_token    = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at,
         updated_at       = NOW()
       RETURNING id`,
      [
        user.id,
        user.login,
        user.display_name,
        user.profile_image_url,
        encrypt(tokens.access_token),
        encrypt(tokens.refresh_token),
        expiresAt,
      ]
    );

    const userId = rows[0].id;

    /* Ensure settings row exists with a unique API key */
    await db.query(
      `INSERT INTO settings (user_id, api_key)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, crypto.randomBytes(32).toString('hex')]
    );

    /* Set session */
    req.session.userId = userId;
    req.session.twitchId = user.id;
    req.session.twitchLogin = user.login;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).send('Authentication failed');
  }
});

/* -------------------------------------------------------
   GET /auth/logout
   ------------------------------------------------------- */
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;