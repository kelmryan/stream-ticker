# 🎮 Stream Toolkit

An ESPN-style scrolling ticker and Extra Life overlay system for **Streamlabs Desktop** (or any streaming software that supports Browser Sources).

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

## What's Included

| File | Description |
|------|-------------|
| `config.js` | All your settings in one place — credentials, colors, timing |
| `stream-ticker.html` | ESPN-style bottom ticker showing followers, subs, cheers, and donations |
| `extralife-overlay.html` | Cycling Extra Life donation overlay with a QR "Scan to Donate" page |

## Features

### Stream Ticker
- **ESPN Bottomline-style** scrolling ticker at the bottom of your stream
- **Four rotating categories:** Latest Followers, Latest Subscribers, Top Cheers, Extra Life Donations
- **Real-time updates** via Streamlabs Socket API — new follows, subs, and cheers appear instantly
- **Persists between streams** using browser localStorage
- **Fully customizable** colors, fonts, speeds, and sizing
- **Graceful fallbacks** — empty categories show "Be the first!" instead of disappearing

### Extra Life Overlay *(optional)*
- Shows your **live Extra Life donation overlay** for a configurable duration
- Followed by a **"Scan to Donate" QR code page** so viewers can donate from their phones
- Smooth fade transitions between phases
- Cycles on a timer (default: 60s overlay → 60s QR → 5min hidden → repeat)

---

## Quick Start

### 1. Download

Download or clone this repository and save the folder somewhere permanent on your PC (e.g., `C:\StreamAssets\stream-toolkit\`).

> ⚠️ **Don't put it in a temp folder** — Streamlabs needs a stable file path.

### 2. Set Up Twitch API Access

The ticker uses the Twitch API to seed your initial followers and bits leaderboard.

#### Register a Twitch Application

1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console)
2. Log in with your Twitch account
3. Click **Register Your Application**
4. Fill in:
   - **Name:** `StreamTicker` (or anything unique)
   - **OAuth Redirect URLs:** `http://localhost`
   - **Category:** `Browser Extension`
5. Click **Create**
6. Click into your new application and copy the **Client ID**

#### Generate an OAuth Token

Open this URL in your browser, replacing `YOUR_CLIENT_ID` with the Client ID you just copied:

```
https://id.twitch.tv/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&response_type=token&scope=moderator:read:followers+channel:read:subscriptions+bits:read
```

1. Click **Authorize**
2. Your browser will redirect to a URL that looks like a broken page — that's expected
3. Copy the **access_token** value from the URL bar (the part between `access_token=` and `&scope`)

> 🔒 **Keep your token private.** Never share it publicly or show it on stream. Tokens expire after ~60 days — repeat this step to get a new one.

### 3. Set Up Streamlabs Socket API

The socket connection captures real-time events (follows, subs, cheers, tips) during your stream.

1. Go to your [Streamlabs Dashboard](https://streamlabs.com/dashboard#/settings/api-settings)
2. Click the **API Tokens** tab
3. Copy your **Socket API Token**

> 🔒 **Keep this token private** — treat it like a password.

### 4. Edit `config.js`

Open `config.js` in any text editor (Notepad, VS Code, etc.) and replace the placeholder values:

```javascript
twitch: {
  clientId:    'paste-your-twitch-client-id-here',
  oauthToken:  'paste-your-twitch-oauth-token-here',
},

streamlabs: {
  socketToken: 'paste-your-streamlabs-socket-token-here',
},
```

#### Extra Life Setup *(optional)*

If you're participating in Extra Life and want the donation overlay + QR code:

1. Find your **Participant ID** — it's the number at the end of your Extra Life profile URL:
   `https://www.extra-life.org/participant/XXXXXX` → `XXXXXX` is your ID
2. Update the config:

```javascript
extraLife: {
  enabled:       true,     // Change false to true
  participantId: '123456', // Your participant ID
},
```

### 5. Add to Streamlabs

#### Stream Ticker

1. Open Streamlabs Desktop
2. Go to the scene where you want the ticker
3. Click **+** (Add Source) → **Browser Source**
4. Name it `Stream Ticker` → click **Add Source**
5. Check **Local File**
6. Browse to `stream-ticker.html`
7. Set **Width:** `1920` and **Height:** `1080` (match your canvas)
8. Click **Done**

#### Extra Life Overlay *(if enabled)*

1. Add another **Browser Source**
2. Name it `Extra Life Overlay`
3. Check **Local File**
4. Browse to `extralife-overlay.html`
5. Set **Width:** `1920` and **Height:** `1080`
6. Click **Done**

---

## Customization

All customization happens in `config.js`. No need to touch the HTML files.

### Colors

Change the ticker's color scheme by editing the `ticker` section:

```javascript
ticker: {
  accentColor:     '#FFD700',  // Category badge & accent color
  accentColorDark: '#DAA520',  // Badge gradient end
  bgColor:         '#0d0d0d',  // Bar background
  textColor:       '#FFFFFF',  // Entry name text
  detailColor:     '#AAAAAA',  // Detail text (bits count, dollar amounts)
  separatorColor:  '#555555',  // Dot separators between entries
},
```

**Popular color schemes:**

| Theme | accentColor | accentColorDark | bgColor |
|-------|------------|----------------|---------|
| Gold & Black | `#FFD700` | `#DAA520` | `#0d0d0d` |
| ESPN Red | `#CC0000` | `#990000` | `#0d0d0d` |
| Neon Blue | `#00D4FF` | `#0099CC` | `#0d0d0d` |
| Purple Twitch | `#9146FF` | `#6B2FD9` | `#0d0d0d` |
| Green Matrix | `#00FF41` | `#00CC33` | `#0d0d0d` |

### Sizing

```javascript
ticker: {
  barHeight:      56,   // Ticker bar height in pixels
  fontSizeLabel:  16,   // Category label font size
  fontSizeRank:   16,   // Rank number font size
  fontSizeName:   17,   // Entry name font size
  fontSizeDetail: 14,   // Detail text font size
},
```

### Behavior

```javascript
ticker: {
  scrollSpeed:      90,    // Pixels per second (higher = faster)
  pauseBetweenMs:   2000,  // Pause between categories in milliseconds
  maxEntries:       10,    // Max entries per category
  showConnectionDot: true, // Show green/red socket status indicator
},
```

### Overlay Timing

```javascript
overlay: {
  overlayShowSec:  60,   // How long the donation overlay shows (seconds)
  qrPageShowSec:   60,   // How long the QR page shows (seconds)
  hideDurationMin: 5,    // How long everything hides (minutes)
},
```

---

## How It Works

### Data Flow

```
┌─────────────────────────────────────────────────┐
│                   On Startup                     │
├─────────────────────────────────────────────────┤
│  1. Load saved data from localStorage            │
│  2. Fetch current followers from Twitch API      │
│  3. Fetch bits leaderboard from Twitch API       │
│  4. Fetch Extra Life donations (if enabled)      │
│  5. Connect to Streamlabs Socket                 │
│  6. Start ticker rotation                        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                During Stream                     │
├─────────────────────────────────────────────────┤
│  Streamlabs Socket fires events in real-time:    │
│  • New follow    → added to Followers list       │
│  • New sub/resub → added to Subscribers list     │
│  • Bits cheered  → added to Cheers list          │
│  • Tip/donation  → added to Donations list       │
│                                                  │
│  All lists saved to localStorage automatically   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                Next Stream                       │
├─────────────────────────────────────────────────┤
│  Previous data loads from localStorage so your   │
│  lists carry over and keep growing.              │
└─────────────────────────────────────────────────┘
```

### Ticker Categories

| Category | Data Source | Notes |
|----------|-----------|-------|
| Latest Followers | Twitch API + Streamlabs Socket | Seeded on load, updated in real-time |
| Latest Subscribers | Streamlabs Socket + localStorage | Builds up over time across streams |
| Top Cheers | Twitch API + Streamlabs Socket | Bits leaderboard seeded on load |
| Extra Life Donations | Extra Life API | Refreshed every 3 minutes (optional) |

---

## Troubleshooting

### Ticker shows "Be the first!" for all categories
- Double-check your **Twitch Client ID** and **OAuth Token** in `config.js`
- Make sure your **Streamlabs Socket Token** is correct
- Check the **connection dot** in the bottom-right corner:
  - 🟢 Green = socket connected
  - 🔴 Red = socket disconnected — check your token
  - ⚫ Gray = still connecting

### Subscribers list is empty
This is normal on first use. The Twitch API only returns *currently active* subscribers, and many may have lapsed. The Streamlabs Socket captures new subs in real-time, and they persist via localStorage. Your list will build up over your streams.

### Extra Life donations not showing
- Make sure `extraLife.enabled` is set to `true` in `config.js`
- Verify your **Participant ID** is correct
- The Extra Life API may have occasional downtime — the ticker will retry every 3 minutes

### OAuth token expired
Twitch OAuth tokens expire after ~60 days. Repeat the [Generate an OAuth Token](#generate-an-oauth-token) step to get a new one, then update `config.js`.

### Ticker looks too big/small
Adjust the `barHeight` and `fontSize*` values in the `ticker` section of `config.js`. No need to edit HTML.

---

## Clearing Saved Data

If you want to reset the ticker's saved follower/sub/cheer lists (e.g., for a fresh start), right-click the Browser Source in Streamlabs → **Interact** → open the browser console (`F12`) → run:

```javascript
localStorage.removeItem('stream_ticker_data');
location.reload();
```

---

## Requirements

- **Streamlabs Desktop** (or any streaming software with Browser Source support, like OBS Studio)
- **Twitch Affiliate or Partner** status (for subscriber data)
- A **Twitch Developer Application** (free to create)
- An internet connection while streaming

---

## Security Notes

Your `config.js` file contains sensitive API tokens. If you share this toolkit or push it to a public repository:

- ✅ **DO** add `config.js` to your `.gitignore`
- ✅ **DO** share `config.example.js` with placeholder values instead
- ❌ **DON'T** commit your real tokens to a public repo
- ❌ **DON'T** show `config.js` on stream

---

## License

MIT License — use it, modify it, share it. If you do something cool with it, we'd love to hear about it!
