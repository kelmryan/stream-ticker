const { Router } = require('express');
const { encrypt } = require('../services/encryption');
const db = require('../db');

const router = Router();

/* -------------------------------------------------------
   Middleware: require logged-in user
   ------------------------------------------------------- */
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

router.use(requireAuth);

/* -------------------------------------------------------
   GET /api/settings
   Return the current user's settings (no secrets)
   ------------------------------------------------------- */
router.get('/settings', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         api_key,
         streamlabs_token IS NOT NULL AS has_streamlabs_token,
         extralife_enabled, extralife_participant_id,
         accent_color, accent_color_dark,
         bg_color, bg_color_light,
         text_color, detail_color, separator_color,
         bar_height, font_size_label, font_size_rank,
         font_size_name, font_size_detail,
         scroll_speed, pause_between_ms, max_entries,
         show_connection_dot,
         overlay_show_sec, qr_page_show_sec, hide_duration_min
       FROM settings
       WHERE user_id = $1`,
      [req.session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/settings error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------------------------------------------
   PUT /api/settings
   Update the current user's settings
   ------------------------------------------------------- */
router.put('/settings', async (req, res) => {
  try {
    const s = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    const ALLOWED_FIELDS = [
      'extralife_enabled', 'extralife_participant_id',
      'accent_color', 'accent_color_dark',
      'bg_color', 'bg_color_light',
      'text_color', 'detail_color', 'separator_color',
      'bar_height', 'font_size_label', 'font_size_rank',
      'font_size_name', 'font_size_detail',
      'scroll_speed', 'pause_between_ms', 'max_entries',
      'show_connection_dot',
      'overlay_show_sec', 'qr_page_show_sec', 'hide_duration_min',
    ];

    for (const field of ALLOWED_FIELDS) {
      if (s[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(s[field]);
        idx++;
      }
    }

    /* Handle Streamlabs token separately (encrypted) */
    if (s.streamlabs_token !== undefined) {
      updates.push(`streamlabs_token = $${idx}`);
      values.push(
        s.streamlabs_token ? encrypt(s.streamlabs_token) : null
      );
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.session.userId);

    await db.query(
      `UPDATE settings SET ${updates.join(', ')} WHERE user_id = $${idx}`,
      values
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/settings error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------------------------------------------
   POST /api/settings/regenerate-key
   Generate a new API key (invalidates old ticker URLs)
   ------------------------------------------------------- */
router.post('/settings/regenerate-key', async (req, res) => {
  try {
    const crypto = require('crypto');
    const newKey = crypto.randomBytes(32).toString('hex');

    await db.query(
      'UPDATE settings SET api_key = $1, updated_at = NOW() WHERE user_id = $2',
      [newKey, req.session.userId]
    );

    res.json({ api_key: newKey });
  } catch (err) {
    console.error('Regenerate key error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
