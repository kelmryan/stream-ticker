const { Router } = require('express');
const db = require('../db');
const { decrypt } = require('../services/encryption');
const { getFreshToken } = require('../services/tokens');
const config = require('../config');

const router = Router();

/* -------------------------------------------------------
   Helper: look up user + settings by API key
   ------------------------------------------------------- */
async function resolveApiKey(apiKey) {
  const { rows } = await db.query(
    `SELECT u.id AS user_id, u.twitch_id, u.access_token, u.refresh_token,
            u.token_expires_at, s.*
     FROM settings s
     JOIN users u ON u.id = s.user_id
     WHERE s.api_key = $1`,
    [apiKey]
  );
  return rows[0] || null;
}

/* -------------------------------------------------------
   GET /ticker/:apiKey
   Serve the personalized ticker page
   ------------------------------------------------------- */
router.get('/ticker/:apiKey', async (req, res) => {
  try {
    const record = await resolveApiKey(req.params.apiKey);
    if (!record) return res.status(404).send('Invalid ticker URL');

    const tickerConfig = {
      twitchClientId: config.twitch.clientId,
      broadcasterId: record.twitch_id,
      streamlabsToken: record.streamlabs_token
        ? decrypt(record.streamlabs_token)
        : null,
      extraLife: {
        enabled: record.extralife_enabled,
        participantId: record.extralife_participant_id,
      },
      ticker: {
        accentColor: record.accent_color,
        accentColorDark: record.accent_color_dark,
        bgColor: record.bg_color,
        bgColorLight: record.bg_color_light,
        textColor: record.text_color,
        detailColor: record.detail_color,
        separatorColor: record.separator_color,
        barHeight: record.bar_height,
        fontSizeLabel: record.font_size_label,
        fontSizeRank: record.font_size_rank,
        fontSizeName: record.font_size_name,
        fontSizeDetail: record.font_size_detail,
        scrollSpeed: record.scroll_speed,
        pauseBetweenMs: record.pause_between_ms,
        maxEntries: record.max_entries,
        showConnectionDot: record.show_connection_dot,
      },
    };

    /* Get a fresh Twitch token for API calls */
    const accessToken = await getFreshToken(record);

    res.render('ticker', {
      config: JSON.stringify(tickerConfig),
      accessToken,
    });
  } catch (err) {
    console.error('Ticker render error:', err.message);
    res.status(500).send('Error loading ticker');
  }
});

/* -------------------------------------------------------
   GET /overlay/:apiKey
   Serve the personalized Extra Life overlay
   ------------------------------------------------------- */
router.get('/overlay/:apiKey', async (req, res) => {
  try {
    const record = await resolveApiKey(req.params.apiKey);
    if (!record) return res.status(404).send('Invalid overlay URL');

    if (!record.extralife_enabled) {
      return res.status(404).send('Extra Life not enabled');
    }

    const overlayConfig = {
      participantId: record.extralife_participant_id,
      overlayShowSec: record.overlay_show_sec,
      qrPageShowSec: record.qr_page_show_sec,
      hideDurationMin: record.hide_duration_min,
    };

    res.render('overlay', {
      config: JSON.stringify(overlayConfig),
    });
  } catch (err) {
    console.error('Overlay render error:', err.message);
    res.status(500).send('Error loading overlay');
  }
});

module.exports = router;
