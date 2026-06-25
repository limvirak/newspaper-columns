// Newspaper Columns — core reader (SINGLE SOURCE OF TRUTH).
// Both the Chrome extension (extension/background.js) and the bookmarklet
// (bookmarklet/index.html) are generated from this file by `node build.js`.
// Do not edit the generated files by hand — edit here and rebuild.
//
// Authoring rules (so the bookmarklet minifier stays safe):
//   - end every statement with a semicolon (no reliance on ASI),
//   - keep each template literal on a single line,
//   - use single quotes or backticks, never double quotes,
//   - only full-line `// ...` comments (no trailing inline comments).
//
// S    = initial settings object (extension passes stored settings; bookmarklet passes null)
// MODE = 'chrome' (persist via chrome.storage.local) or 'local' (persist via localStorage)
function toggleNewspaperColumns(S, MODE) {

  const ex = document.getElementById('_npcols');
  if (ex) { document.body.removeChild(ex); return; }

  // --- Settings ---
  const FONTS = [
    { label: 'Serif', css: 'Georgia, "Times New Roman", serif', lh: 1.8 },
    { label: 'Sans', css: '-apple-system, system-ui, "Segoe UI", sans-serif', lh: 1.7 },
    { label: 'Iowan', css: '"Iowan Old Style", "Palatino Linotype", Palatino, serif', lh: 1.75 },
  ];
  const THEMES = [
    { label: 'Cream', bg: '#fdf9f3', fg: '#1a1a1a', muted: '#aaa', rule: '#e8e4dc', quote: '#555', bar: '#ccc' },
    { label: 'White', bg: '#ffffff', fg: '#111111', muted: '#bbb', rule: '#eeeeee', quote: '#555', bar: '#ddd' },
    { label: 'Sepia', bg: '#f4ecd8', fg: '#5b4636', muted: '#a09078', rule: '#e3d9c2', quote: '#6b5746', bar: '#cbbb9a' },
    { label: 'Night', bg: '#1a1a1a', fg: '#d4cfc5', muted: '#666', rule: '#333', quote: '#9a948a', bar: '#444' },
  ];
  const MINS = 13, MAXS = 24;
  const DEFAULTS = { font: 0, size: 17, cols: 0, theme: 0 };

  function load() {
    let saved = {};
    if (MODE === 'local') {
      try { saved = JSON.parse(localStorage.getItem('_npcols') || '{}'); } catch (e) { saved = {}; }
    } else {
      saved = S || {};
    }
    const out = Object.assign({}, DEFAULTS, saved);
    out.font = (out.font % FONTS.length + FONTS.length) % FONTS.length;
    out.theme = (out.theme % THEMES.length + THEMES.length) % THEMES.length;
    out.size = Math.min(MAXS, Math.max(MINS, out.size | 0));
    out.cols = Math.min(6, Math.max(0, out.cols | 0));
    return out;
  }
  function save() {
    if (MODE === 'chrome') {
      try { chrome.storage.local.set({ '_npcols': st }); } catch (e) {}
    } else {
      try { localStorage.setItem('_npcols', JSON.stringify(st)); } catch (e) {}
    }
  }
  const st = load();

  // --- Text extraction ---
  const src = document.querySelector(
    'article, .article-body, .article__body, .story-body, ' +
    '.post-content, .entry-content, .content-body, main'
  ) || document.body;

  const clone = src.cloneNode(true);

  clone.querySelectorAll(
    'img, picture, figure, figcaption, video, audio, iframe, embed, ' +
    'nav, aside, header, footer, form, button, input, select, textarea, ' +
    'script, style, noscript, svg, canvas'
  ).forEach(n => n.remove());

  const noise = /advert|promo|related|share|social|newsletter|subscri|sidebar|widget|banner|cookie|comment|disqus|taboola|outbrain/;
  clone.querySelectorAll('[class], [id]').forEach(el => {
    const cn = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    if (noise.test(cn) || noise.test(id)) el.remove();
  });

  const tags = clone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, blockquote');
  let html = '';
  tags.forEach(el => {
    if (el.textContent.trim().length > 30) {
      const tag = el.tagName.toLowerCase();
      html += `<${tag}>${el.innerHTML.trim()}</${tag}>`;
    }
  });
  if (!html) html = `<p>${clone.textContent.replace(/\s+/g, ' ').trim()}</p>`;

  // --- Geometry (recomputed on every layout change) ---
  const PAD = 60, GAP = 48, BARH = 44;
  let cw = 0, ch = 0, cols = 0, pageW = 1, page = 0;

  function computeGeom() {
    cw = window.innerWidth - PAD * 2;
    ch = window.innerHeight - PAD * 2 - BARH;
    cols = st.cols === 0 ? Math.max(1, Math.round(cw / 360)) : st.cols;
    cols = Math.min(6, Math.max(1, cols));
    pageW = cw + GAP;
  }
  computeGeom();

  // --- Build DOM ---
  const overlay = document.createElement('div');
  overlay.id = '_npcols';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:hidden;';

  const clip = document.createElement('div');

  const inner = document.createElement('div');
  inner.innerHTML = html + '<span id="_npcols_end" style="display:inline-block;width:0;height:0"></span>';

  const bar = document.createElement('div');

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'ESC · ✕ Close';
  closeBtn.onclick = doClose;

  const hintEl = document.createElement('span');
  hintEl.textContent = 'Space / → turn · F font · −/+ size · C cols · B theme';

  const progEl = document.createElement('span');

  bar.append(closeBtn, hintEl, progEl);

  const toast = document.createElement('div');
  toast.style.cssText = 'position:absolute;left:50%;bottom:64px;transform:translateX(-50%);padding:8px 16px;border-radius:20px;font-family:-apple-system,system-ui,sans-serif;font-size:13px;pointer-events:none;opacity:0;transition:opacity .25s;';

  const styleEl = document.createElement('style');

  clip.appendChild(inner);
  overlay.append(styleEl, clip, bar, toast);
  document.body.appendChild(overlay);

  // --- Rendering ---
  function applyStyles() {
    const f = FONTS[st.font], t = THEMES[st.theme];
    overlay.style.background = t.bg;
    clip.style.cssText =
      `position:absolute;top:${PAD}px;left:${PAD}px;width:${cw}px;height:${ch}px;overflow:hidden;`;
    inner.style.cssText =
      `height:100%;columns:${cols};column-gap:${GAP}px;column-fill:auto;` +
      `font-family:${f.css};font-size:${st.size}px;line-height:${f.lh};color:${t.fg};` +
      'orphans:4;widows:4;hyphens:auto;transition:transform .35s cubic-bezier(.4,0,.2,1);';
    bar.style.cssText =
      `position:absolute;bottom:0;left:0;right:0;height:${BARH}px;` +
      'display:flex;align-items:center;justify-content:space-between;' +
      `padding:0 ${PAD}px;font-family:-apple-system,system-ui,sans-serif;font-size:12px;` +
      `color:${t.muted};border-top:1px solid ${t.rule};background:${t.bg};`;
    closeBtn.style.cssText =
      `background:none;border:1px solid ${t.rule};border-radius:4px;padding:3px 10px;` +
      `cursor:pointer;font-size:12px;color:${t.muted};font-family:inherit;`;
    toast.style.background = t.fg;
    toast.style.color = t.bg;
    styleEl.textContent = [
      '#_npcols h1{font-size:1.5em;break-after:avoid;margin:0 0 0.6em;line-height:1.3}',
      '#_npcols h2{font-size:1.25em;break-after:avoid;margin:1.4em 0 0.4em;line-height:1.3}',
      '#_npcols h3,#_npcols h4{font-size:1.05em;break-after:avoid;margin:1.2em 0 0.3em}',
      '#_npcols p{margin:0 0 1em}',
      `#_npcols blockquote{border-left:3px solid ${t.bar};padding-left:1em;margin:0 0 1em;font-style:italic;color:${t.quote}}`,
      '#_npcols a{color:inherit;text-decoration:none}',
      '#_npcols *{max-width:100%;box-sizing:border-box}',
    ].join('');
  }

  function getTotal() {
    const s = document.getElementById('_npcols_end');
    if (!s) return page + 2;
    const sr = s.getBoundingClientRect();
    const cr = clip.getBoundingClientRect();
    return Math.max(page + 1, Math.ceil(((sr.left - cr.left) + page * pageW + 1) / pageW));
  }

  function updateProg() {
    progEl.textContent = `${page + 1} / ${getTotal()}`;
  }

  function goTo(n) {
    const total = getTotal();
    if (n < 0) n = 0;
    if (n >= total) { doClose(); return; }
    page = n;
    inner.style.transform = `translateX(${-page * pageW}px)`;
    updateProg();
  }

  // Full re-layout after a settings or viewport change: keep the reader open,
  // recompute geometry, clamp the current page, and re-measure.
  function relayout() {
    computeGeom();
    applyStyles();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const total = getTotal();
      if (page >= total) page = total - 1;
      if (page < 0) page = 0;
      inner.style.transform = `translateX(${-page * pageW}px)`;
      updateProg();
    }));
  }

  let toastTimer = 0;
  function flash(msg) {
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1200);
  }

  function doClose() {
    if (document.getElementById('_npcols')) document.body.removeChild(overlay);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
  }

  let resizeRaf = 0;
  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; relayout(); });
  }

  function onKey(e) {
    if (!document.getElementById('_npcols')) {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      return;
    }
    const k = e.key;
    if (k === ' ' || k === 'ArrowRight' || k === 'PageDown') {
      e.preventDefault(); goTo(page + 1);
    } else if (k === 'ArrowLeft' || k === 'PageUp') {
      e.preventDefault(); goTo(page - 1);
    } else if (k === 'Escape') {
      e.preventDefault(); doClose();
    } else if (k === 'f' || k === 'F') {
      e.preventDefault();
      st.font = (st.font + 1) % FONTS.length; save(); relayout(); flash('Font · ' + FONTS[st.font].label);
    } else if (k === 'b' || k === 'B') {
      e.preventDefault();
      st.theme = (st.theme + 1) % THEMES.length; save(); relayout(); flash('Theme · ' + THEMES[st.theme].label);
    } else if (k === 'c' || k === 'C') {
      e.preventDefault();
      st.cols = st.cols >= 4 ? 0 : st.cols + 1; save(); relayout();
      flash('Columns · ' + (st.cols === 0 ? 'Auto (' + cols + ')' : st.cols));
    } else if (k === '+' || k === '=') {
      e.preventDefault();
      st.size = Math.min(MAXS, st.size + 1); save(); relayout(); flash('Size · ' + st.size + 'px');
    } else if (k === '-' || k === '_') {
      e.preventDefault();
      st.size = Math.max(MINS, st.size - 1); save(); relayout(); flash('Size · ' + st.size + 'px');
    }
  }

  applyStyles();
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  requestAnimationFrame(() => requestAnimationFrame(updateProg));
}
