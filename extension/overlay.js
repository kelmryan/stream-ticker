/* -------------------------------------------------------
   Stream Ticker — Twitch video overlay extension

   Data and appearance come from the EBS (/ext/ticker), which
   reads the broadcaster's settings and Twitch/Extra Life data
   server-side. This page only renders and scrolls it.
   ------------------------------------------------------- */
(function () {
  'use strict';

  const POLL_MS = 60 * 1000;
  const CONTROLS_OFFSET_PX = 56;
  const HIDDEN_KEY = 'stream_ticker_hidden';

  const tickerEl = document.getElementById('ticker');
  const labelEl = document.getElementById('category-label');
  const areaEl = document.getElementById('scroll-area');
  const contentEl = document.getElementById('scroll-content');
  const hideBtn = document.getElementById('hide-btn');
  const showBtn = document.getElementById('show-btn');
  const root = document.documentElement.style;

  let authToken = null;
  let pollTimer = null;
  let style = null;
  let data = null;
  let categories = [];
  let categoryIndex = 0;
  let rotating = false;
  let scrollFrame = null;
  let viewerHidden = readHidden();

  /* ---- Per-viewer "hide ticker" preference ---- */
  function readHidden() {
    try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch (e) { return false; }
  }

  function writeHidden(value) {
    try { localStorage.setItem(HIDDEN_KEY, value ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function updateVisibility() {
    const hasData = Boolean(data);
    tickerEl.classList.toggle('hidden', !hasData || viewerHidden);
    showBtn.classList.toggle('hidden', !hasData || !viewerHidden);
  }

  hideBtn.addEventListener('click', () => {
    viewerHidden = true;
    writeHidden(true);
    updateVisibility();
  });

  showBtn.addEventListener('click', () => {
    viewerHidden = false;
    writeHidden(false);
    updateVisibility();
  });

  /* ---- Appearance ---- */
  /* Dashboard sizes are authored for a 720p-ish canvas; scale to the player */
  function computeScale() {
    return Math.min(1.25, Math.max(0.6, window.innerHeight / 720));
  }

  function px(n, fallback) {
    return (Number(n) || fallback) * computeScale() + 'px';
  }

  function applyStyle() {
    if (!style) return;
    root.setProperty('--scale', String(computeScale()));
    root.setProperty('--bar-h', px(style.barHeight, 56));
    root.setProperty('--accent', style.accentColor);
    root.setProperty('--accent-dark', style.accentColorDark);
    root.setProperty('--bg', style.bgColor);
    root.setProperty('--bg-light', style.bgColorLight || style.bgColor);
    root.setProperty('--text', style.textColor);
    root.setProperty('--detail', style.detailColor);
    root.setProperty('--separator', style.separatorColor);
    root.setProperty('--fs-label', px(style.fontSizeLabel, 16));
    root.setProperty('--fs-rank', px(style.fontSizeRank, 16));
    root.setProperty('--fs-name', px(style.fontSizeName, 17));
    root.setProperty('--fs-detail', px(style.fontSizeDetail, 14));
  }

  window.addEventListener('resize', applyStyle);

  /* ---- Rendering ---- */
  function buildCategories() {
    const cats = [
      { key: 'followers', label: 'Latest Followers' },
      { key: 'subscribers', label: 'Latest Subscribers' },
      { key: 'cheers', label: 'Top Cheers' },
    ];
    if (data.extraLifeEnabled) cats.push({ key: 'extralife', label: 'Extra Life Donations' });
    return cats;
  }

  function entriesFor(key) {
    const list = (data.lists && data.lists[key]) || [];
    return list.length > 0 ? list : [{ name: 'Be the first!', detail: '' }];
  }

  function span(className, text) {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  }

  function buildScrollContent(entries) {
    contentEl.textContent = '';
    entries.forEach((entry, i) => {
      if (i > 0) contentEl.appendChild(span('entry-separator', '•'));
      const el = span('entry', '');
      el.appendChild(span('entry-rank', (i + 1) + '.'));
      el.appendChild(span('entry-name', entry.name));
      if (entry.detail) el.appendChild(span('entry-detail', '(' + entry.detail + ')'));
      contentEl.appendChild(el);
    });
  }

  function updateCategoryLabel(text) {
    labelEl.textContent = text;
    labelEl.classList.remove('fade-in');
    void labelEl.offsetWidth;
    labelEl.classList.add('fade-in');
  }

  function startScroll(onComplete) {
    cancelAnimationFrame(scrollFrame);
    const areaW = areaEl.offsetWidth;
    const total = areaW + contentEl.offsetWidth;
    const speed = (Number(style.scrollSpeed) || 90) * computeScale();
    const duration = (total / speed) * 1000;
    const start = performance.now();

    contentEl.style.transform = 'translateX(' + areaW + 'px)';

    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      contentEl.style.transform = 'translateX(' + (areaW - p * total) + 'px)';
      if (p < 1) scrollFrame = requestAnimationFrame(frame);
      else onComplete();
    }
    scrollFrame = requestAnimationFrame(frame);
  }

  function showNextCategory() {
    if (!data) { rotating = false; return; }
    categories = buildCategories();
    categoryIndex %= categories.length;
    const cat = categories[categoryIndex];

    updateCategoryLabel(cat.label);
    buildScrollContent(entriesFor(cat.key));
    startScroll(() => {
      categoryIndex = (categoryIndex + 1) % categories.length;
      setTimeout(showNextCategory, Number(style.pauseBetweenMs) || 2000);
    });
  }

  /* ---- EBS polling ---- */
  async function poll() {
    if (!authToken) return;
    try {
      const res = await fetch(window.EBS_URL + '/ext/ticker', {
        headers: { Authorization: 'Bearer ' + authToken },
      });

      if (res.status === 404) {
        /* Broadcaster installed the extension but hasn't linked an account */
        data = null;
      } else if (res.ok) {
        const payload = await res.json();
        data = payload;
        style = payload.ticker;
        applyStyle();
      }
      /* Other errors: keep showing the last good data */
    } catch (e) {
      Twitch.ext.rig.log('Ticker fetch failed: ' + e.message);
    }

    updateVisibility();
    if (data && !rotating) {
      rotating = true;
      showNextCategory();
    }
  }

  /* ---- Twitch helper hooks ---- */
  Twitch.ext.onAuthorized((auth) => {
    const first = !authToken;
    authToken = auth.token;
    if (first) {
      poll();
      pollTimer = setInterval(poll, POLL_MS);
    }
  });

  /* Lift the ticker above the player controls while they're showing */
  Twitch.ext.onContext((ctx, changed) => {
    if (changed.indexOf('arePlayerControlsVisible') === -1) return;
    root.setProperty('--controls-offset', ctx.arePlayerControlsVisible ? CONTROLS_OFFSET_PX + 'px' : '0px');
  });

  /* Stop work when the broadcaster deactivates or the viewer hides extensions */
  Twitch.ext.onVisibilityChanged((isVisible) => {
    if (isVisible) {
      if (!pollTimer && authToken) {
        poll();
        pollTimer = setInterval(poll, POLL_MS);
      }
    } else {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });
})();
