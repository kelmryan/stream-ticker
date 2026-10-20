#!/usr/bin/env node
/* -------------------------------------------------------
   Checks the Twitch Extension files against the rules that
   get extensions rejected in review, then optionally builds
   the upload zip.

   Usage (from the repo root):
     node ci/validate-extension.js           # check only
     node ci/validate-extension.js --zip     # check, then build stream-ticker-extension.zip
   ------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const EXT_DIR = path.join(__dirname, '..', 'extension');
const ZIP_PATH = path.join(__dirname, '..', 'stream-ticker-extension.zip');
const TWITCH_HELPER = 'https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js';

/* The paths entered in Asset Hosting on dev.twitch.tv */
const REQUIRED_PAGES = ['video_overlay.html', 'config.html'];

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

for (const page of REQUIRED_PAGES) {
  if (!fs.existsSync(path.join(EXT_DIR, page))) fail(page, 'missing (it is set as a path in Asset Hosting)');
}

for (const file of fs.readdirSync(EXT_DIR).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(EXT_DIR, file), 'utf8');

  /* Twitch's CSP blocks inline script, so every <script> needs a src */
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    const src = (tag.match(/\bsrc="([^"]+)"/i) || [])[1];
    if (!src) {
      fail(file, 'inline <script> (Twitch CSP blocks it; move the code to a .js file)');
    } else if (/^https?:/i.test(src)) {
      if (src !== TWITCH_HELPER) fail(file, `remote script ${src} (only the Twitch helper is allowed)`);
    } else if (!fs.existsSync(path.join(EXT_DIR, src))) {
      fail(file, `script ${src} not found`);
    }
  }

  /* Inline event handlers are inline script too */
  const handler = html.match(/\son[a-z]+\s*=\s*["']/i);
  if (handler) fail(file, `inline event handler (${handler[0].trim()}...)`);

  for (const [, href] of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/gi)) {
    if (!/^https?:/i.test(href) && !fs.existsSync(path.join(EXT_DIR, href))) {
      fail(file, `stylesheet ${href} not found`);
    }
  }

  if (!html.includes(TWITCH_HELPER)) fail(file, 'does not load the Twitch extension helper');
}

/* The backend URL must be HTTPS and is what goes in the URL fetching allowlist */
const ebs = fs.readFileSync(path.join(EXT_DIR, 'ebs-url.js'), 'utf8');
const ebsUrl = (ebs.match(/EBS_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1];
if (!ebsUrl) fail('ebs-url.js', 'could not find window.EBS_URL');
else if (!/^https:\/\/[^/]+$/.test(ebsUrl)) fail('ebs-url.js', `EBS_URL must be https://host with no path or trailing slash, got ${ebsUrl}`);

if (errors.length > 0) {
  console.error('Extension check failed:\n  ' + errors.join('\n  '));
  process.exit(1);
}

console.log('Extension check passed.');
console.log(`  URL fetching allowlist must contain: ${ebsUrl}`);

if (process.argv.includes('--zip')) {
  const files = fs.readdirSync(EXT_DIR).filter(
    (f) => fs.statSync(path.join(EXT_DIR, f)).isFile() && !f.endsWith('.md')
  );
  fs.rmSync(ZIP_PATH, { force: true });
  /* Files at the zip root, not inside an extension/ folder */
  execFileSync('zip', ['-q', ZIP_PATH, ...files], { cwd: EXT_DIR, stdio: 'inherit' });
  console.log(`Built ${path.relative(process.cwd(), ZIP_PATH)} with: ${files.join(', ')}`);
}
