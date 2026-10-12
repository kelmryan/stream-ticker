# Stream Ticker — Twitch Extension

An ESPN-style ticker that runs along the bottom of your Twitch stream. It shows your **latest followers**, **latest subscribers**, **top cheers**, and, if you turn it on, your **Extra Life donations**. Twitch runs it as a video overlay extension, so you don't need OBS or Streamlabs browser sources.

- [For streamers: setup walkthrough](#for-streamers-setup-walkthrough)
- [For viewers](#for-viewers)
- [Troubleshooting](#troubleshooting)
- [For developers: building and hosting the extension](#for-developers-building-and-hosting-the-extension)

---

## For streamers: setup walkthrough

Setup takes about five minutes. You do it once, and after that the ticker runs whenever the extension is active.

### Step 1: Install the extension
1. On Twitch, open **Creator Dashboard → Extensions**.
2. Search for **Stream Ticker** and click **Install**.

### Step 2: Connect your Twitch account
1. On the extension's card in **My Extensions**, click the gear icon (**Configure**).
2. The config page shows one of two messages:
   - **"One more step: connect your Twitch account."** Click **Connect with Twitch**. In the new tab, approve the permissions (listed below), then go back to the config page and refresh it.
   - **"✓ Connected as YourName"** means you're already linked. Go to Step 3.

The ticker asks Twitch for **read-only** access to:

| Permission | Used for |
|------------|----------|
| `moderator:read:followers` | Latest Followers |
| `channel:read:subscriptions` | Latest Subscribers |
| `bits:read` | Top Cheers (bits leaderboard) |

The extension can't post to chat, change your channel, or do anything else. Your Twitch login stays on the Stream Ticker server and never reaches viewers.

### Step 3: Activate it as an overlay
1. Back in **Creator Dashboard → Extensions → My Extensions**, click **Activate** on Stream Ticker.
2. Choose **Set as Overlay 1**. Twitch allows one active overlay, so this replaces any overlay you already have.

The ticker now shows over your video for anyone watching live.

### Step 4 (optional): Customize it
On the config page, click **Open dashboard**. These settings change the extension:

| Setting | What it does | Default |
|---------|--------------|---------|
| **Enable Extra Life** + **Participant ID** | Adds an "Extra Life Donations" category. The ID is the number at the end of your `extra-life.org/participant/XXXXXX` URL. | Off |
| **Accent Color** / **Accent Dark** | The category label on the left of the bar | Gold |
| **Background** / **Text Color** | Bar background and name text | Black / white |
| **Bar Height (px)** | How tall the bar is | 56 |
| **Name Font Size** | Size of the names | 17 |
| **Scroll Speed (px/sec)** | How fast names scroll | 90 |
| **Max Entries** | How many names each category shows | 10 |

Click **Save Settings**. Viewers see the changes within about a minute.

> **Note:** The dashboard also has settings that **only affect the browser-source version**. These are the Streamlabs Socket token, the browser source URLs, Show Connection Dot, and Overlay Timing. The extension ignores them.

### What viewers will see
The ticker cycles through each category in turn:

1. **Latest Followers**
2. **Latest Subscribers**
3. **Top Cheers**
4. **Extra Life Donations** (only if enabled)

Each category's names scroll across the bar, then the next category starts. An empty category shows **"Be the first!"**. The ticker size scales with the player. It moves up when the player controls appear, so it doesn't cover them.

**Update speed:** the extension refreshes **once a minute**. A new follower or sub can take up to about 60 seconds to show. If you need instant alerts, use the browser-source ticker from the main project.

---

## For viewers

- The ticker sits along the bottom of the video and shows the channel's recent supporters.
- **To hide it**, hover over the ticker and click the **×** on the right. A **Show ticker** button appears so you can bring it back. Your browser remembers this choice.
- To hide **all** extensions, use the extensions toggle in Twitch's player settings.
- The extension doesn't need you to log in, and it doesn't collect information about you.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Config page says *"Couldn't reach the Stream Ticker server"* | The server may be briefly down. Wait a minute and refresh. |
| Config page still says *"connect your Twitch account"* after signing in | Refresh the config page. Make sure you signed in with the **same Twitch account** as the channel. |
| Ticker doesn't appear at all | Check that the extension is **activated as an overlay**, not just installed. Also check that your account is connected (Step 2). Viewers who clicked × see only the "Show ticker" button. |
| Subscribers always show "Be the first!" | Twitch only reports subscribers for **Affiliate and Partner** channels. |
| Top Cheers always empty | The bits leaderboard is empty until someone cheers on your channel. |
| Extra Life category missing | On the dashboard, turn on **Enable Extra Life**, enter your **Participant ID**, and click Save. |
| Ticker stops showing new followers after a long time | Your Twitch connection may have been revoked, for example if you changed your password or removed the app under Twitch **Settings → Connections**. Click **Connect with Twitch** on the config page again. |
| Colors/sizes didn't change | Make sure you clicked **Save Settings**, then wait up to a minute. |

---

## For developers: building and hosting the extension

This section is for whoever runs the Stream Ticker server and publishes the extension on dev.twitch.tv. Streamers don't need it.

### How it works

```
Viewer's browser (Twitch-hosted iframe)        Your server (EBS)                 Twitch / Extra Life
  video_overlay.html ── JWT ──▶  GET /ext/ticker ── broadcaster's token ──▶  Helix followers/subs/bits
                                  (60s cache per channel)                      Extra Life donations
  config.html ─────────── JWT ──▶  GET /ext/status
```

- Twitch signs a JWT for each viewer. The JWT carries the `channel_id` of the stream being watched.
- The EBS (`app/server/routes/extension.js`) verifies the JWT using the extension secret. It then looks up the broadcaster by `users.twitch_id` and returns ticker data plus the colors and sizes saved on their dashboard.
- Broadcaster tokens never reach viewers. Every viewer of a channel shares one cached fetch per minute.
- Broadcasters still sign in once at the website. The extension's config page sends them there.

**Not included yet:** real-time Streamlabs events. Viewers can't hold a Streamlabs token, so the extension refreshes every 60s instead. Instant updates would need Twitch EventSub plus Extension PubSub.

### Files

| File | Purpose |
|------|---------|
| `video_overlay.html` / `overlay.js` / `overlay.css` | The ticker viewers see over the video |
| `config.html` / `config-page.js` / `config.css` | Broadcaster setup page: shows link status and points to the dashboard |
| `ebs-url.js` | URL of your backend |

Twitch's CSP blocks inline scripts and remote scripts other than the Twitch helper, so all JS lives in local files.

### Setup

#### 1. Create the extension
1. Go to [dev.twitch.tv/console/extensions](https://dev.twitch.tv/console/extensions) and click **Create Extension**.
2. Under type, choose **Video - Fullscreen** only.
3. In **Asset Hosting** (version settings):
   - Video - Fullscreen Viewer Path: `video_overlay.html`
   - Config Path: `config.html`
   - Live Config Path: leave empty
   - **Allowlist for URL Fetching Domains:** `https://d1zot23mk1qpgp.cloudfront.net`
4. In **Capabilities**, leave everything off. The extension doesn't need chat, bits or identity link.

#### 2. Configure the backend
In **Extension Settings**, copy the **Client ID**. Under *Extension Client Configuration*, create and copy the **Extension Secret** (base64). Add both to the ECS task definition's environment:

```
TWITCH_EXTENSION_CLIENT_ID=...
TWITCH_EXTENSION_SECRET=...
```

Without these variables the `/ext` routes return 503 and the rest of the app works as before.

#### 3. CloudFront
By default CloudFront drops the `Authorization` header and rejects `OPTIONS` (CORS preflight). Add a behavior for the path pattern `/ext/*`:
- Allowed methods: **GET, HEAD, OPTIONS**
- Cache policy: **CachingDisabled**
- Origin request policy: **AllViewerExceptHostHeader**

#### 4. Upload and test
```bash
cd extension
zip -r ../stream-ticker-extension.zip . -x README.md
```
1. Under **Files**, upload the zip.
2. Move the version to **Hosted Test**.
3. On your own channel, go to **Creator Dashboard → Extensions**. Install the extension, open its config (it should show "Connected as …"), then activate it as an **Overlay**.
4. Go live, or use a test stream, and check the ticker over the video. It moves up when the player controls appear. Viewers can hide it with the × button that shows on hover.

#### 5. Submit for review
In **Review** you need:
- A description
- Screenshots of the overlay and config page
- A 100×100 / 24×24 icon
- Testing instructions, for example: "Broadcaster signs in at https://d1zot23mk1qpgp.cloudfront.net, then activates the overlay"

After approval, click **Release**. Streamers can then find it by searching "ticker" in the Extensions directory.
