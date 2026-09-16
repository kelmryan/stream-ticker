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
   Start
   ------------------------------------------------------- */
app.listen(config.port, () => {
  console.log(`Stream Ticker App running on port ${config.port}`);
  console.log(`  ${config.appUrl}`);
});
