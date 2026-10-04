# Stream Ticker — Twitch Extension

A **video overlay** Twitch Extension version of the ticker. Once it's approved, any streamer can find it in **Creator Dashboard → Extensions** and install it. No OBS browser source needed.

## How it works

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

## Files

| File | Purpose |
|------|---------|
| `video_overlay.html` / `overlay.js` / `overlay.css` | The ticker viewers see over the video |
| `config.html` / `config-page.js` / `config.css` | Broadcaster setup page: shows link status and points to the dashboard |
| `ebs-url.js` | URL of your backend |

Twitch's CSP blocks inline scripts and remote scripts other than the Twitch helper, so all JS lives in local files.

## Setup

### 1. Create the extension
1. Go to [dev.twitch.tv/console/extensions](https://dev.twitch.tv/console/extensions) and click **Create Extension**.
2. Under type, choose **Video - Fullscreen** only.
3. In **Asset Hosting** (version settings):
   - Video - Fullscreen Viewer Path: `video_overlay.html`
   - Config Path: `config.html`
   - Live Config Path: leave empty
   - **Allowlist for URL Fetching Domains:** `https://d1zot23mk1qpgp.cloudfront.net`
4. In **Capabilities**, leave everything off. The extension doesn't need chat, bits or identity link.

### 2. Configure the backend
In **Extension Settings**, copy the **Client ID**. Under *Extension Client Configuration*, create and copy the **Extension Secret** (base64). Add both to the ECS task definition's environment:

```
TWITCH_EXTENSION_CLIENT_ID=...
TWITCH_EXTENSION_SECRET=...
```

Without these variables the `/ext` routes return 503 and the rest of the app works as before.

### 3. CloudFront
By default CloudFront drops the `Authorization` header and rejects `OPTIONS` (CORS preflight). Add a behavior for the path pattern `/ext/*`:
- Allowed methods: **GET, HEAD, OPTIONS**
- Cache policy: **CachingDisabled**
- Origin request policy: **AllViewerExceptHostHeader**

### 4. Upload and test
```bash
cd extension
zip -r ../stream-ticker-extension.zip . -x README.md
```
1. Under **Files**, upload the zip.
2. Move the version to **Hosted Test**.
3. On your own channel, go to **Creator Dashboard → Extensions**. Install the extension, open its config (it should show "Connected as …"), then activate it as an **Overlay**.
4. Go live, or use a test stream, and check the ticker over the video. It moves up when the player controls appear. Viewers can hide it with the × button that shows on hover.

### 5. Submit for review
In **Review** you need:
- A description
- Screenshots of the overlay and config page
- A 100×100 / 24×24 icon
- Testing instructions, for example: "Broadcaster signs in at https://d1zot23mk1qpgp.cloudfront.net, then activates the overlay"

After approval, click **Release**. Streamers can then find it by searching "ticker" in the Extensions directory.
