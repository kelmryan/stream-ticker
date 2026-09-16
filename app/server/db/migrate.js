const { pool } = require('./index');

const MIGRATIONS = [
  {
    name: '001_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id              SERIAL PRIMARY KEY,
        twitch_id       VARCHAR(64) UNIQUE NOT NULL,
        twitch_login    VARCHAR(128) NOT NULL,
        twitch_display   VARCHAR(128) NOT NULL,
        twitch_avatar   TEXT,
        access_token    TEXT NOT NULL,
        refresh_token   TEXT NOT NULL,
        token_expires_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: '002_create_settings',
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        api_key         VARCHAR(64) UNIQUE NOT NULL,
        streamlabs_token TEXT,

        /* Extra Life */
        extralife_enabled    BOOLEAN DEFAULT FALSE,
        extralife_participant_id VARCHAR(32),

        /* Ticker appearance */
        accent_color         VARCHAR(9) DEFAULT '#FFD700',
        accent_color_dark    VARCHAR(9) DEFAULT '#DAA520',
        bg_color             VARCHAR(9) DEFAULT '#0d0d0d',
        bg_color_light       VARCHAR(9) DEFAULT '#1a1a1a',
        text_color           VARCHAR(9) DEFAULT '#FFFFFF',
        detail_color         VARCHAR(9) DEFAULT '#AAAAAA',
        separator_color      VARCHAR(9) DEFAULT '#555555',

        bar_height           INTEGER DEFAULT 56,
        font_size_label      INTEGER DEFAULT 16,
        font_size_rank       INTEGER DEFAULT 16,
        font_size_name       INTEGER DEFAULT 17,
        font_size_detail     INTEGER DEFAULT 14,

        scroll_speed         INTEGER DEFAULT 90,
        pause_between_ms     INTEGER DEFAULT 2000,
        max_entries          INTEGER DEFAULT 10,
        show_connection_dot  BOOLEAN DEFAULT TRUE,

        /* Overlay timing */
        overlay_show_sec     INTEGER DEFAULT 60,
        qr_page_show_sec    INTEGER DEFAULT 60,
        hide_duration_min    INTEGER DEFAULT 5,

        created_at           TIMESTAMPTZ DEFAULT NOW(),
        updated_at           TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE(user_id)
      );
    `,
  },
  {
    name: '003_create_migrations_tracker',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        run_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
];

async function migrate() {
  const client = await pool.connect();

  try {
    /* Ensure migrations table exists first */
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        run_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    for (const migration of MIGRATIONS) {
      const { rows } = await client.query(
        'SELECT 1 FROM migrations WHERE name = $1',
        [migration.name]
      );

      if (rows.length === 0) {
        console.log(`Running migration: ${migration.name}`);
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        console.log(`  ✓ ${migration.name}`);
      } else {
        console.log(`  — ${migration.name} (already applied)`);
      }
    }

    console.log('All migrations complete.');
  } finally {
    client.release();
  }

  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
