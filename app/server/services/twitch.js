const axios = require('axios');
const config = require('../config');

const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2';
const TWITCH_API_URL = 'https://api.twitch.tv/helix';

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.twitch.clientId,
    redirect_uri: config.twitch.redirectUri,
    response_type: 'code',
    scope: config.twitch.scopes,
    state,
  });
  return `${TWITCH_AUTH_URL}/authorize?${params}`;
}

async function exchangeCode(code) {
  const { data } = await axios.post(`${TWITCH_AUTH_URL}/token`, null, {
    params: {
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.twitch.redirectUri,
    },
  });
  return data;
}

async function refreshAccessToken(refreshToken) {
  const { data } = await axios.post(`${TWITCH_AUTH_URL}/token`, null, {
    params: {
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
  });
  return data;
}

function apiHeaders(accessToken) {
  return {
    'Client-ID': config.twitch.clientId,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function getUser(accessToken) {
  const { data } = await axios.get(`${TWITCH_API_URL}/users`, {
    headers: apiHeaders(accessToken),
  });
  return data.data?.[0] || null;
}

async function getFollowers(accessToken, broadcasterId, max = 10) {
  const { data } = await axios.get(`${TWITCH_API_URL}/channels/followers`, {
    headers: apiHeaders(accessToken),
    params: { broadcaster_id: broadcasterId, first: max },
  });
  return (data.data || []).map((f) => ({
    name: f.user_name,
    detail: '',
  }));
}

async function getSubscribers(accessToken, broadcasterId, max = 10) {
  const { data } = await axios.get(`${TWITCH_API_URL}/subscriptions`, {
    headers: apiHeaders(accessToken),
    params: { broadcaster_id: broadcasterId, first: max },
  });
  return (data.data || [])
    .filter((s) => s.user_id !== broadcasterId)
    .map((s) => ({
      name: s.user_name,
      detail: s.tier ? `T${parseInt(s.tier) / 1000}` : '',
    }));
}

async function getBitsLeaderboard(accessToken, max = 10) {
  const { data } = await axios.get(`${TWITCH_API_URL}/bits/leaderboard`, {
    headers: apiHeaders(accessToken),
    params: { count: max },
  });
  return (data.data || []).map((b) => ({
    name: b.user_name,
    detail: `${b.score.toLocaleString()} bits`,
  }));
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCode,
  refreshAccessToken,
  getUser,
  getFollowers,
  getSubscribers,
  getBitsLeaderboard,
};
