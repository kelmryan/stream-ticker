# Twitch Review Resubmission Checklist

Notes for resubmitting Stream Ticker after the review rejection (items 1.2, 1.3 and 4.1).

Reviewers don't unzip and run the extension on their own machine. They install the version you submitted on a Twitch test channel, open its config page, and follow the **Testing Instructions** you entered in the Review form. The zip only supplies the hosted files, so the fixes below are mostly settings in the [Twitch developer console](https://dev.twitch.tv/console/extensions) plus text for the Review form.

---

## 1. Create a new version

The rejected version can't be edited. In the console, open Stream Ticker → **Versions** → **Create New Version** (for example `0.0.2`). Check every setting below on the **new** version. Some settings are per version.

## 2. Fix 1.2: "404 on the panel version"

The extension only has a video overlay and a config page. It has no panel page, so if **Panel** is enabled, Twitch loads a file that doesn't exist.

- **Asset Hosting → Type of Extension:** check **Video - Fullscreen** only. **Uncheck Panel** (and Mobile/Component).
- **Video - Fullscreen Viewer Path:** `video_overlay.html`
- **Config Path:** `config.html`
- **Live Config Path:** leave empty
- **Panel Viewer Path:** leave empty (or remove it)

## 3. Fix 1.2: "Couldn't reach the Stream Ticker server"

The backend is up. On 2026-10-20 `/ext/status` returned the expected 401 without a token, CORS allowed the extension origin, and CloudFront passed the `Authorization` header. So the problem is most likely one of these:

- [ ] **Asset Hosting → Allowlist for URL Fetching Domains** contains exactly:
  ```
  https://d1zot23mk1qpgp.cloudfront.net
  ```
  If it's missing, Twitch's CSP blocks the request before it leaves the browser. **This is the most likely cause.**
- [ ] **Extension Client ID matches the server.** The server only allows the origin `https://87otjqjo5v7ps1g7dm3s7ic8hp9278.ext-twitch.tv`. Confirm the Client ID under **Extension Settings** is `87otjqjo5v7ps1g7dm3s7ic8hp9278`. If it's different, update `TWITCH_EXTENSION_CLIENT_ID` in the ECS task definition.
- [ ] **Extension Secret matches the server.** If the secret was regenerated after it was put in ECS, every request fails with `401 Invalid token`. Copy the current secret into `TWITCH_EXTENSION_SECRET` and redeploy the service.

The config page now shows the reason under the error message, which tells you which item to fix:

| Detail shown | Cause |
|--------------|-------|
| `Network request blocked (check the URL fetching allowlist).` | Allowlist missing/wrong, or Client ID mismatch (CORS) |
| `HTTP 401: Invalid token` | Extension Secret on the server is wrong |
| `HTTP 403: Broadcaster only` | Config page was opened by someone other than the channel owner |
| `HTTP 503: Extension not configured` | Extension env vars missing in ECS |
| `HTTP 500: Server error` | Check the ECS logs (database or Twitch API error) |

### Test it yourself before resubmitting

1. Rebuild and upload the zip (see step 6).
2. Move the new version to **Hosted Test**.
3. On your channel: **Creator Dashboard → Extensions → My Extensions → Stream Ticker → Configure**. It must say **"Connected as …"** (or "connect your Twitch account" for an unlinked account), **not** the error.
4. Activate as **Overlay 1**, open your channel, and confirm the ticker scrolls along the bottom of the video.
5. Take the screenshots for step 5 while you're here.

## 4. Fix 1.3: description and testing instructions

Paste these into the Review form fields. Remove the Extra Life note if you'd rather not use your participant ID.

### Summary

```
An ESPN-style scrolling ticker over your video showing your latest followers, subscribers, top cheers and Extra Life donations.
```

### Description

```
Stream Ticker adds an ESPN-style "bottom line" ticker across the bottom of your stream. It cycles through four lists:

- Latest Followers
- Latest Subscribers
- Top Cheers (bits leaderboard)
- Extra Life Donations (optional, for Extra Life charity streamers)

Setup takes one step: open the extension's configuration page, click "Connect with Twitch" and approve read-only access to your followers, subscribers and bits leaderboard. Then activate the extension as an overlay.

Colors, bar height, font size, scroll speed, number of names and Extra Life are set on the Stream Ticker dashboard (linked from the configuration page). Lists refresh about once a minute.

Viewers can hide the ticker at any time with the × button that appears when they hover over it.
```

### Testing Instructions

```
No test account is needed. Use your own reviewer Twitch account.

1. Install the extension on your test channel and open its Configuration page (Extensions > My Extensions > Stream Ticker > gear icon).
2. The page says "One more step: connect your Twitch account." Click "Connect with Twitch". A new tab opens at https://d1zot23mk1qpgp.cloudfront.net and asks you to authorize read-only scopes (moderator:read:followers, channel:read:subscriptions, bits:read). Approve.
3. Close that tab, go back to the Configuration page and refresh it. It now says "Connected as <your name>".
4. Activate the extension as Overlay 1.
5. Open your channel. A ticker bar appears along the bottom of the video, cycling through "Latest Followers", "Latest Subscribers" and "Top Cheers". On a new test channel these lists are empty and show "Be the first!". This is expected. Following the test channel from another account adds a name within about a minute.
6. Hover over the ticker and click the × on the right to hide it. A "Show ticker" button brings it back.

Optional, to see a list with real data: on the Configuration page click "Open dashboard", check "Enable Extra Life", enter Participant ID 579835 and click "Save Settings". Within a minute the ticker adds an "Extra Life Donations" list with real donations.

Subscribers only appear for Affiliate/Partner channels, so that list stays "Be the first!" on a test channel.
```

## 5. Fix 4.1: images

Upload these in the console under **Version → Images/Discovery** before moving to review. Images added after moving to Hosted Test are not picked up.

| Image | Size | What it should show |
|-------|------|---------------------|
| Screenshot (at least one) | e.g. 1024×768 | The ticker running over real video, taken on your channel during Hosted Test |
| Screenshot (recommended) | e.g. 1024×768 | The config page showing "Connected as …" |
| Discovery image | **300×200** | The ticker bar or logo |
| Discovery icon | **100×100** | Icon |
| Taskbar icon | **24×24** | Icon (Twitch asks for this too) |

Screenshots must be real captures of the extension, not mockups.

## 6. Rebuild and upload the zip

From the repo root:

```bash
cd extension
rm -f ../stream-ticker-extension.zip
zip -r ../stream-ticker-extension.zip . -x '*.md'
```

If WSL says `zip: command not found`, run `sudo apt install zip` first, or zip the files (not the folder) from Windows Explorer.

Upload it under the new version's **Files**. The zip must have the HTML files at its root, not inside a folder.

## 7. Resubmit

Hosted Test works and the images are uploaded → **Move to Ready for Review** → fill in the Review form (step 4) → **Submit**.
