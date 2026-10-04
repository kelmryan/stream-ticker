const { Router } = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('../db');
const twitch = require('../services/twitch');
const { getFreshToken } = require('../services/tokens');
const config = require('../config');

/* -------------------------------------------------------
   Twitch Extension Backend Service (EBS)

   The extension frontend (hosted by Twitch, see /extension)
   calls these routes with the JWT from Twitch.ext.onAuthorized.
   The JWT's channel_id identifies which broadcaster's data
   to serve. Broadcaster tokens never leave the server.
   ------------------------------------------------------- */

const router = Router();
const ext = config.extension;
const EXTRALIFE_API = 'https://dd.extra-life.org/api';
const CACHE_TTL_MS = 60 * 1000;

if (!ext.clientId || !ext.secret) {
  router.use((req, res) => res.status(503).json({ error: 'Extension not configured' }));
  module.exports = router;
  return;
}

const secret = Buffer.from(ext.secret, 'base64');

router.use(
  cors({
    origin: `https://${ext.clientId}.ext-twitch.tv`,
    allowedHeaders: ['Authorization'],
    methods: ['GET'],
    maxAge: 86400,
  })
);

/* -------------------------------------------------------
   Middleware: verify the extension JWT
   ------------------------------------------------------- */
function verifyExtensionJwt(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    req.ext = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!req.ext.channel_id) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
}

router.use(verifyExtensionJwt);

/* -------------------------------------------------------
   Helper: look up user + settings by Twitch channel ID
   ------------------------------------------------------- */
async function resolveChannel(channelId) {
  const { rows } = await db.query(
    `SELECT u.id AS user_id, u.twitch_id, u.twitch_login, u.twitch_display,
            u.access_token, u.refresh_token, u.token_expires_at, s.*
     FROM users u
     JOIN settings s ON s.user_id = u.id
     WHERE u.twitch_id = $1`,
    [channelId]
  );
  return rows[0] || null;
}

/* -------------------------------------------------------
   Helper: build ticker payload for a channel.
   Each source fails independently so one bad scope or API
   outage doesn't blank the whole ticker.
   ------------------------------------------------------- */
async function settle(promise, label) {
  try {
    return await promise;
  } catch (err) {
    console.warn(`EBS ${label} fetch failed:`, err.response?.status || err.message);
    return [];
  }
}

async function fetchExtraLife(participantId, max) {
  const { data } = await axios.get(
    `${EXTRALIFE_API}/participants/${encodeURIComponent(participantId)}/donations`,
    { params: { limit: max, orderBy: 'createdDateUTC DESC' } }
  );
  return (data || []).map((d) => ({
    name: d.displayName || 'Anonymous',
    detail: d.amount ? `$${Number(d.amount).toFixed(2)}` : '',
  }));
}

async function buildTickerPayload(record) {
  const accessToken = await getFreshToken(record);
  const max = record.max_entries;
  const extraLifeOn = record.extralife_enabled && record.extralife_participant_id;

  const [followers, subscribers, cheers, extralife] = await Promise.all([
    settle(twitch.getFollowers(accessToken, record.twitch_id, max), 'followers'),
    settle(twitch.getSubscribers(accessToken, record.twitch_id, max), 'subscribers'),
    settle(twitch.getBitsLeaderboard(accessToken, max), 'bits'),
    extraLifeOn
      ? settle(fetchExtraLife(record.extralife_participant_id, max), 'extralife')
      : [],
  ]);

  return {
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
    },
    extraLifeEnabled: Boolean(extraLifeOn),
    lists: { followers, subscribers, cheers, extralife },
  };
}

/* -------------------------------------------------------
   Per-channel cache. Every viewer of a channel polls this,
   so Twitch/Extra Life are hit at most once per TTL per
   channel, and concurrent misses share one in-flight fetch.
   ------------------------------------------------------- */
const cache = new Map();

function getCachedTicker(channelId) {
  const hit = cache.get(channelId);
  if (hit && hit.expires > Date.now()) return hit.promise;

  const promise = (async () => {
    const record = await resolveChannel(channelId);
    return record ? buildTickerPayload(record) : null;
  })();

  cache.set(channelId, { promise, expires: Date.now() + CACHE_TTL_MS });
  promise.catch(() => cache.delete(channelId));
  return promise;
}

/* -------------------------------------------------------
   GET /ext/ticker
   Ticker data + appearance for the JWT's channel
   ------------------------------------------------------- */
router.get('/ticker', async (req, res) => {
  try {
    const payload = await getCachedTicker(req.ext.channel_id);
    if (!payload) return res.status(404).json({ error: 'Channel not linked' });
    res.json(payload);
  } catch (err) {
    console.error('EBS /ticker error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------------------------------------------
   GET /ext/status
   Broadcaster config page: is this channel linked?
   ------------------------------------------------------- */
router.get('/status', async (req, res) => {
  if (req.ext.role !== 'broadcaster') {
    return res.status(403).json({ error: 'Broadcaster only' });
  }

  try {
    const record = await resolveChannel(req.ext.channel_id);
    res.json({
      linked: Boolean(record),
      display: record?.twitch_display || null,
      signupUrl: `${config.appUrl}/auth/twitch`,
      dashboardUrl: `${config.appUrl}/dashboard`,
    });
  } catch (err) {
    console.error('EBS /status error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
