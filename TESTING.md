# Testing

Every check runs the same way on your machine, in GitHub Actions (`.github/workflows/ci.yml`) and in GitLab CI (`.gitlab-ci.yml`). Run them locally before pushing, or before uploading a new extension version to Twitch.

All commands run from the repo root.

## Requirements

- **Node.js 18 or newer** (CI uses Node 20)
- **Docker**, only for the smoke test. It starts its own Postgres, so you don't need a database or a `.env` file.

Install the app's packages once:

```bash
cd app && npm install && cd ..
```

## 1. Unit tests: extension backend

```bash
cd app && npm test && cd ..
```

These test `app/server/routes/extension.js`, the server the Twitch extension calls. The database, Twitch and Extra Life are faked, so nothing real is touched. They check:

- Requests without a token, with a wrong-secret token, or without a `channel_id` get **401**
- CORS allows the extension's `*.ext-twitch.tv` origin and no other
- `/ext/status` is broadcaster-only and reports linked/unlinked channels with the right links
- `/ext/ticker` returns 404 for unlinked channels, and returns lists plus colors for linked ones
- One failing source (for example subscribers) doesn't blank the other lists
- Extra Life donations appear when enabled
- Viewers of the same channel share one cached fetch

Tests live in `app/test/*.test.js` and use Node's built-in test runner, so there are no extra packages.

## 2. Extension check (and the upload zip)

```bash
node ci/validate-extension.js
```

This checks `extension/` for the problems that get extensions rejected in Twitch review:

- `video_overlay.html` and `config.html` exist (the paths set in Asset Hosting)
- No inline `<script>` or `onclick=` handlers, which Twitch's CSP blocks
- The only remote script is the Twitch helper, and every local `.js`/`.css` file referenced actually exists
- `ebs-url.js` holds an `https://` URL. The check prints it, because that exact URL must be in **Allowlist for URL Fetching Domains**

To also build `stream-ticker-extension.zip` for uploading to Twitch:

```bash
node ci/validate-extension.js --zip
```

This needs the `zip` command (`sudo apt install zip` in WSL).

## 3. Smoke test: the real server

```bash
bash ci/smoke-test.sh
```

This starts a throwaway Postgres container on port **5433**, runs the real server on port **3999** with dummy settings, and checks that:

| Route | Expected |
|-------|----------|
| `/health` | 200 |
| `/` (landing page) | 200 |
| `/dashboard` while signed out | 302 redirect |
| `/api/settings` while signed out | 401 |
| `/ticker/<unknown key>` | 404 |
| `/ext/status` with no token / a bad token | 401 |
| `/ext/ticker` CORS preflight from the extension origin | 204 |

The container is removed when the script finishes, whether it passes or fails. If something fails, the server's log is printed. Use `SMOKE_PORT=4000 bash ci/smoke-test.sh` if port 3999 is busy.

This also confirms the startup migrations work on an empty database.

## 4. Docker image

```bash
docker build -t stream-ticker-app app
```

This only checks that the image builds. It doesn't push to ECR or deploy. Deploying is still the manual steps in `app/README.md`.

## Testing the extension on Twitch

The checks above can't run the extension inside Twitch, because it needs the token Twitch gives it. To try it for real, upload the zip to a new version, move it to **Hosted Test**, and follow `extension/REVIEW.md`. If the config page shows an error, the detail line under it says which setting to fix.

---

## GitHub Actions

`.github/workflows/ci.yml` runs on every push and on pull requests to `master`:

| Job | Same as |
|-----|---------|
| Unit tests | `npm test` |
| Extension check | `node ci/validate-extension.js` |
| Smoke test | `bash ci/smoke-test.sh` (uses a GitHub Postgres service instead of Docker) |
| Extension zip | `node ci/validate-extension.js --zip`, with the zip saved as an artifact for 30 days |
| Docker build | `docker build` |

See results on the repo's **Actions** tab, or in the checks on a pull request. To get the extension zip: open the workflow run → **Artifacts** at the bottom of the summary page.

## GitLab CI

`.gitlab-ci.yml` runs these jobs on every push:

| Stage | Job | Same as |
|-------|-----|---------|
| test | `unit-tests` | `npm test` |
| test | `extension-check` | `node ci/validate-extension.js` |
| test | `smoke-test` | `bash ci/smoke-test.sh` (uses a GitLab Postgres service instead of Docker) |
| package | `extension-zip` | `node ci/validate-extension.js --zip`, with the zip saved as a job artifact for 30 days |
| build | `docker-build` | `docker build` (only when files under `app/` change) |

To get the extension zip from CI: open the pipeline → `extension-zip` job → **Browse** or **Download** under Job artifacts.

**Runner requirements:** GitLab.com's shared runners work as they are. On a self-hosted runner, `docker-build` needs the Docker executor with `privileged = true` (for Docker-in-Docker). Remove that job if your runner can't do that.

No CI/CD variables or secrets are needed; every job uses dummy values.
