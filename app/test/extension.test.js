/* -------------------------------------------------------
   Tests for the Twitch Extension Backend (routes/extension.js)

   The database, Twitch and Extra Life calls are stubbed, so
   these run without Postgres or network access.
   Run with: npm test
   ------------------------------------------------------- */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const EXT_CLIENT_ID = 'testextclientid';
const EXT_SECRET = Buffer.from('test-extension-secret').toString('base64');
const EXT_ORIGIN = `https://${EXT_CLIENT_ID}.ext-twitch.tv`;

/* Config is read when the modules load, so env goes first */
Object.assign(process.env, {
  APP_URL: 'https://ticker.example.com',
  SESSION_SECRET: 'test',
  DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
  TWITCH_CLIENT_ID: 'test',
  TWITCH_CLIENT_SECRET: 'test',
  ENCRYPTION_KEY: '0'.repeat(64),
  TWITCH_EXTENSION_CLIENT_ID: EXT_CLIENT_ID,
  TWITCH_EXTENSION_SECRET: EXT_SECRET,
});

const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('../server/db');
const twitch = require('../server/services/twitch');
const tokens = require('../server/services/tokens');

/* ---- Stubs ---- */
let channels = {};
let dbCalls = 0;

db.query = async (sql, params) => {
  dbCalls++;
  const record = channels[params[0]];
  return { rows: record ? [record] : [] };
};
tokens.getFreshToken = async () => 'broadcaster-token';
twitch.getFollowers = async () => [{ name: 'follower1', detail: '' }];
twitch.getSubscribers = async () => { throw new Error('missing scope'); };
twitch.getBitsLeaderboard = async () => [{ name: 'cheerer1', detail: '500 bits' }];
axios.get = async () => ({ data: [{ displayName: 'Donor', amount: 25 }] });

const extensionRoutes = require('../server/routes/extension');

function linkedChannel(channelId, overrides = {}) {
  channels[channelId] = {
    user_id: 1,
    twitch_id: channelId,
    twitch_login: 'streamer',
    twitch_display: 'Streamer',
    max_entries: 10,
    extralife_enabled: false,
    extralife_participant_id: null,
    accent_color: '#FFD700',
    scroll_speed: 90,
    ...overrides,
  };
}

function sign(payload, secret = Buffer.from(EXT_SECRET, 'base64')) {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '5m' });
}

/* ---- Server ---- */
let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use('/ext', extensionRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

beforeEach(() => {
  channels = {};
  dbCalls = 0;
});

function get(path, token, headers = {}) {
  return fetch(baseUrl + path, {
    headers: {
      Origin: EXT_ORIGIN,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
  });
}

/* ---- JWT verification ---- */
test('rejects requests without a token', async () => {
  const res = await get('/ext/status');
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Missing token' });
});

test('rejects a token signed with the wrong secret', async () => {
  const token = sign({ channel_id: '1', role: 'broadcaster' }, 'wrong-secret');
  const res = await get('/ext/status', token);
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Invalid token' });
});

test('rejects a token without a channel_id', async () => {
  const res = await get('/ext/status', sign({ role: 'broadcaster' }));
  assert.equal(res.status, 401);
});

/* ---- CORS ---- */
test('allows CORS preflight from the extension origin', async () => {
  const res = await fetch(baseUrl + '/ext/status', {
    method: 'OPTIONS',
    headers: {
      Origin: EXT_ORIGIN,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), EXT_ORIGIN);
  assert.match(res.headers.get('access-control-allow-headers'), /authorization/i);
});

test('does not grant CORS to other origins', async () => {
  const res = await get('/ext/status', null, { Origin: 'https://evil.example.com' });
  assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://evil.example.com');
});

/* ---- GET /ext/status ---- */
test('status is broadcaster-only', async () => {
  const res = await get('/ext/status', sign({ channel_id: '100', role: 'viewer' }));
  assert.equal(res.status, 403);
});

test('status reports an unlinked channel with a sign-up link', async () => {
  const res = await get('/ext/status', sign({ channel_id: '101', role: 'broadcaster' }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.linked, false);
  assert.equal(body.signupUrl, 'https://ticker.example.com/auth/twitch');
});

test('status reports a linked channel', async () => {
  linkedChannel('102');
  const res = await get('/ext/status', sign({ channel_id: '102', role: 'broadcaster' }));
  const body = await res.json();
  assert.equal(body.linked, true);
  assert.equal(body.display, 'Streamer');
  assert.equal(body.dashboardUrl, 'https://ticker.example.com/dashboard');
});

/* ---- GET /ext/ticker ---- */
test('ticker returns 404 for an unlinked channel', async () => {
  const res = await get('/ext/ticker', sign({ channel_id: '200', role: 'viewer' }));
  assert.equal(res.status, 404);
});

test('ticker returns lists and style; one failing source does not blank the rest', async () => {
  linkedChannel('201');
  const res = await get('/ext/ticker', sign({ channel_id: '201', role: 'viewer' }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ticker.accentColor, '#FFD700');
  assert.equal(body.extraLifeEnabled, false);
  assert.equal(body.lists.followers[0].name, 'follower1');
  assert.deepEqual(body.lists.subscribers, []);
  assert.equal(body.lists.cheers[0].name, 'cheerer1');
  assert.deepEqual(body.lists.extralife, []);
});

test('ticker includes Extra Life donations when enabled', async () => {
  linkedChannel('202', { extralife_enabled: true, extralife_participant_id: '579835' });
  const res = await get('/ext/ticker', sign({ channel_id: '202', role: 'viewer' }));
  const body = await res.json();
  assert.equal(body.extraLifeEnabled, true);
  assert.deepEqual(body.lists.extralife, [{ name: 'Donor', detail: '$25.00' }]);
});

test('ticker caches per channel so viewers share one fetch', async () => {
  linkedChannel('203');
  const token = sign({ channel_id: '203', role: 'viewer' });
  await get('/ext/ticker', token);
  await get('/ext/ticker', token);
  assert.equal(dbCalls, 1);
});
