const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const { pool } = require('./db');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const tickerRoutes = require('./routes/ticker');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);

/* Health check — must be before session middleware */
/* Health check — must be before session middleware */
app.get('/health', (req, res) => {
  console.log('Health check hit');
  res.status(200).send('ok');
});
/* Debug: confirm server is ready */
console.log('Express app configured, health endpoint registered');
/* -------------------------------------------------------
   Middleware
   ------------------------------------------------------- */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, /* 7 days */
    },
  })
);

/* View engine */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

/* Static files */
app.use(express.static(path.join(__dirname, '..', 'public')));

/* -------------------------------------------------------
   Routes
   ------------------------------------------------------- */

/* Landing page */
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('index');
});

/* Dashboard (protected) */
app.get('/dashboard', requireAuth, async (req, res) => {
  const db = require('./db');
  const { rows } = await db.query(
    `SELECT s.*, u.twitch_login, u.twitch_display, u.twitch_avatar
     FROM settings s
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id = $1`,
    [req.session.userId]
  );

  res.render('dashboard', {
    user: {
      login: req.session.twitchLogin,
      display: rows[0]?.twitch_display,
      avatar: rows[0]?.twitch_avatar,
    },
    settings: rows[0],
    appUrl: config.appUrl,
  });
});

/* Auth */
app.use('/auth', authRoutes);

/* API */
app.use('/api', apiRoutes);

/* Ticker & overlay (public, keyed by API key) */
app.use('/', tickerRoutes);

/* -------------------------------------------------------
   Auto-migrate & Start
   ------------------------------------------------------- */
async function runMigrations() {
  const { query } = require('./db');
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        run_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrations = [
      {
        name: '001_create_users',
        sql: `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          twitch_id VARCHAR(64) UNIQUE NOT NULL,
          twitch_login VARCHAR(128) NOT NULL,
          twitch_display VARCHAR(128) NOT NULL,
          twitch_avatar TEXT,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          token_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
      },
      {
        name: '002_create_settings',
        sql: `CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          api_key VARCHAR(64) UNIQUE NOT NULL,
          streamlabs_token TEXT,
          extralife_enabled BOOLEAN DEFAULT FALSE,
          extralife_participant_id VARCHAR(32),
          accent_color VARCHAR(9) DEFAULT '#FFD700',
          accent_color_dark VARCHAR(9) DEFAULT '#DAA520',
          bg_color VARCHAR(9) DEFAULT '#0d0d0d',
          bg_color_light VARCHAR(9) DEFAULT '#1a1a1a',
          text_color VARCHAR(9) DEFAULT '#FFFFFF',
          detail_color VARCHAR(9) DEFAULT '#AAAAAA',
          separator_color VARCHAR(9) DEFAULT '#555555',
          bar_height INTEGER DEFAULT 56,
          font_size_label INTEGER DEFAULT 16,
          font_size_rank INTEGER DEFAULT 16,
          font_size_name INTEGER DEFAULT 17,
          font_size_detail INTEGER DEFAULT 14,
          scroll_speed INTEGER DEFAULT 90,
          pause_between_ms INTEGER DEFAULT 2000,
          max_entries INTEGER DEFAULT 10,
          show_connection_dot BOOLEAN DEFAULT TRUE,
          overlay_show_sec INTEGER DEFAULT 60,
          qr_page_show_sec INTEGER DEFAULT 60,
          hide_duration_min INTEGER DEFAULT 5,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id)
        )`,
      },
    ];

    for (const m of migrations) {
      const { rows } = await query('SELECT 1 FROM migrations WHERE name = $1', [m.name]);
      if (rows.length === 0) {
        console.log(`Running migration: ${m.name}`);
        await query(m.sql);
        await query('INSERT INTO migrations (name) VALUES ($1)', [m.name]);
      }
    }
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

runMigrations().then(() => {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Stream Ticker App running on port ${config.port}`);
    console.log(`  ${config.appUrl}`);
  });
});