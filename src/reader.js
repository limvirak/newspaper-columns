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
  // Returns 'opened' | 'closed' | 'error: ...' so the extension can report a
  // failure inside the page instead of failing silently.
  try {
    return runReader(S, MODE);
  } catch (e) {
    console.error('Newspaper Columns:', e);
    return 'error: ' + (e && e.message ? e.message : e);
  }

function runReader(S, MODE) {

  const ex = document.getElementById('_npcols');
  if (ex) { document.body.removeChild(ex); return 'closed'; }

  // --- Settings ---
  const FONTS = [
    { label: 'Serif', css: 'Georgia, "Times New Roman", serif', lh: 1.8 },
    { label: 'Sans', css: '-apple-system, system-ui, "Segoe UI", sans-serif', lh: 1.7 },
    { label: 'Iowan', css: '"Iowan Old Style", "Palatino Linotype", Palatino, serif', lh: 1.75 },
  ];
  const THEMES = [
    { label: 'Cream', bg: '#fdf9f3', fg: '#1a1a1a', muted: '#9c968c', rule: '#e8e4dc', quote: '#555', bar: '#ccc', hi: '#fce9a6' },
    { label: 'White', bg: '#ffffff', fg: '#111111', muted: '#9aa0a6', rule: '#eeeeee', quote: '#555', bar: '#ddd', hi: '#fff1a8' },
    { label: 'Sepia', bg: '#f4ecd8', fg: '#5b4636', muted: '#a09078', rule: '#e3d9c2', quote: '#6b5746', bar: '#cbbb9a', hi: '#e4cf92' },
    { label: 'Night', bg: '#1a1a1a', fg: '#d4cfc5', muted: '#777', rule: '#333', quote: '#9a948a', bar: '#444', hi: '#4a4120' },
  ];
  const MINS = 13, MAXS = 24;
  const DEFAULTS = { font: 0, size: 17, cols: 0, theme: 0, images: 1 };

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
    out.images = out.images ? 1 : 0;
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

  // --- Text + image extraction ----------------------------------------------
  // Walk the best content container in document order so images and graphs stay
  // interleaved with the text they belong to. Blocks (headings, paragraphs,
  // blockquotes, figures) are emitted whole so their inline emphasis
  // (<strong>, <em>, <mark>, links) is preserved; other containers are
  // descended into so standalone images aren't missed.
  const noise = /advert|promo|related|share|social|newsletter|subscri|sidebar|widget|banner|cookie|comment|disqus|taboola|outbrain|newsletter|paywall|metadata|byline/;
  const SKIP = /^(nav|aside|footer|form|script|style|noscript|iframe|video|audio|embed|canvas|button|input|select|textarea)$/;
  const BLOCK = /^(h[1-6]|p|blockquote)$/;

  // Copy real image URLs out of lazy-loading attributes onto src/srcset.
  function unlazy(root) {
    root.querySelectorAll('img').forEach(im => {
      const ds = im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || im.getAttribute('data-original') || im.getAttribute('data-hi-res-src');
      const cur = im.getAttribute('src') || '';
      if (ds && (!cur || /^data:image\/(gif|svg)|blank|placeholder|spacer|1x1/i.test(cur))) im.setAttribute('src', ds);
      const dss = im.getAttribute('data-srcset');
      if (dss && !im.getAttribute('srcset')) im.setAttribute('srcset', dss);
      im.removeAttribute('loading'); im.removeAttribute('class'); im.removeAttribute('style');
    });
  }
  // Clone a live element and sanitise it (drop nested junk, un-lazy images).
  function clean(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('script, style, noscript, button, input').forEach(n => n.remove());
    unlazy(c);
    return c;
  }
  // Keep standalone images only if they render reasonably large (skips icons,
  // tracking pixels, logos) or sit inside a <figure>.
  // Inline SVG counts as a chart only if it is chart-sized (skips icons, logos, dividers).
  function bigSvg(el) {
    const r = el.getBoundingClientRect();
    return r.width >= 120 && r.height >= 80;
  }
  function keepImg(el) {
    const r = el.getBoundingClientRect();
    return (r.width >= 120 && r.height >= 80) || !!el.closest('figure');
  }

  function extract() {
    const src = document.querySelector(
      'article, .article-body, .article__body, .story-body, ' +
      '.post-content, .entry-content, .content-body, main'
    ) || document.body;
    let out = '';
    if (!src.querySelector('h1')) {
      const h = document.querySelector('h1');
      if (h && h.textContent.trim().length > 3 && !h.closest('nav, footer, aside') && h.getBoundingClientRect().width > 0) {
        out += `<h1>${clean(h).innerHTML.trim()}</h1>`;
      }
    }
    (function walk(node) {
      const kids = node.children;
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i];
        const tag = el.tagName.toLowerCase();
        if (tag === 'svg') {
          if (st.images && bigSvg(el)) out += `<figure class="_npimg">${el.outerHTML}</figure>`;
          continue;
        }
        if (tag === 'header') {
          if (node !== document.body && el.querySelector('h1, figure, picture, img')) walk(el);
          continue;
        }
        if (SKIP.test(tag)) continue;
        const cn = (typeof el.className === 'string' ? el.className : '').toLowerCase();
        if (noise.test(cn) || noise.test((el.id || '').toLowerCase())) continue;
        if (BLOCK.test(tag)) {
          const hasImg = st.images && el.querySelector('img');
          if (el.textContent.trim().length > 30 || hasImg) {
            const c = clean(el);
            if (!st.images) c.querySelectorAll('img, picture').forEach(n => n.remove());
            out += `<${tag}>${c.innerHTML}</${tag}>`;
          }
        } else if (tag === 'figure') {
          if (st.images) {
            const hasPic = el.querySelector('img, picture');
            const hasChart = !hasPic && Array.from(el.querySelectorAll('svg')).some(bigSvg);
            if (hasPic || hasChart) out += `<figure class="_npimg">${clean(el).innerHTML}</figure>`;
          } else {
            const cap = el.querySelector('figcaption');
            if (cap && cap.textContent.trim().length > 30) out += `<p class="_npcap">${cap.innerHTML}</p>`;
          }
        } else if (tag === 'img' || tag === 'picture') {
          if (st.images && keepImg(el)) out += `<figure class="_npimg">${clean(el).outerHTML}</figure>`;
        } else {
          walk(el);
        }
      }
    })(src);
    if (!out) out = `<p>${(src.textContent || '').replace(/\s+/g, ' ').trim()}</p>`;
    return out;
  }

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
  const bar = document.createElement('div');

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'ESC · ✕ Close';
  closeBtn.onclick = doClose;

  const hintEl = document.createElement('span');
  hintEl.textContent = 'Space / → turn · F font · −/+ size · C cols · B theme · I images';

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
    const maxImgH = Math.round(ch * 0.82);
    overlay.style.background = t.bg;
    clip.style.cssText =
      `position:absolute;top:${PAD}px;left:${PAD}px;width:${cw}px;height:${ch}px;overflow:hidden;`;
    inner.style.cssText =
      `height:100%;columns:${cols};column-gap:${GAP}px;column-fill:auto;` +
      `font-family:${f.css};font-size:${st.size}px;line-height:${f.lh};color:${t.fg};` +
      'orphans:4;widows:4;hyphens:auto;transition:transform .35s cubic-bezier(.4,0,.2,1);';
    bar.style.cssText =
      `position:absolute;bottom:0;left:0;right:0;height:${BARH}px;` +
      'display:flex;align-items:center;justify-content:space-between;gap:16px;' +
      `padding:0 ${PAD}px;font-family:-apple-system,system-ui,sans-serif;font-size:12px;` +
      `color:${t.muted};border-top:1px solid ${t.rule};background:${t.bg};`;
    closeBtn.style.cssText =
      `background:none;border:1px solid ${t.rule};border-radius:4px;padding:3px 10px;` +
      `cursor:pointer;font-size:12px;color:${t.muted};font-family:inherit;white-space:nowrap;`;
    hintEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    toast.style.background = t.fg;
    toast.style.color = t.bg;
    styleEl.textContent = [
      '#_npcols h1{font-size:1.5em;break-after:avoid;margin:0 0 0.6em;line-height:1.3}',
      '#_npcols h2{font-size:1.25em;break-after:avoid;margin:1.4em 0 0.4em;line-height:1.3}',
      '#_npcols h3,#_npcols h4{font-size:1.05em;break-after:avoid;margin:1.2em 0 0.3em}',
      '#_npcols p{margin:0 0 1em}',
      `#_npcols blockquote{border-left:3px solid ${t.bar};padding-left:1em;margin:0 0 1em;font-style:italic;color:${t.quote}}`,
      '#_npcols a{color:inherit;text-decoration:none}',
      `#_npcols strong,#_npcols b{font-weight:700;color:${t.fg}}`,
      '#_npcols em,#_npcols i{font-style:italic}',
      `#_npcols mark{background:${t.hi};color:${t.fg};padding:0 .12em;border-radius:2px}`,
      `#_npcols code{font-family:ui-monospace,Menlo,monospace;font-size:0.88em;background:${t.hi};padding:0 .25em;border-radius:3px}`,
      `#_npcols ._npimg{margin:0.2em 0 1.1em;break-inside:avoid;-webkit-column-break-inside:avoid;text-align:center}`,
      `#_npcols ._npimg img{display:block;max-width:100%;max-height:${maxImgH}px;width:auto;height:auto;margin:0 auto;border-radius:2px}`,
      `#_npcols ._npimg svg{display:block;max-width:100%;max-height:${maxImgH}px;height:auto;margin:0 auto}`,
      `#_npcols p ._npimg,#_npcols p img{max-width:100%}`,
      `#_npcols figcaption,#_npcols ._npcap{font-size:0.8em;line-height:1.4;color:${t.muted};margin:0.45em 0 0;font-family:-apple-system,system-ui,sans-serif;font-style:normal}`,
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

  // Re-clamp the current page and refresh the counter without moving the reader
  // to the start — used after images load and change the total width.
  function remeasure() {
    const total = getTotal();
    if (page >= total) page = total - 1;
    if (page < 0) page = 0;
    inner.style.transform = `translateX(${-page * pageW}px)`;
    updateProg();
  }

  let remeasureRaf = 0;
  function scheduleRemeasure() {
    if (remeasureRaf) return;
    remeasureRaf = requestAnimationFrame(() => { remeasureRaf = 0; remeasure(); });
  }

  // Full re-layout after a settings or viewport change.
  function relayout() {
    computeGeom();
    applyStyles();
    requestAnimationFrame(() => requestAnimationFrame(remeasure));
  }

  // Re-extract content (used when toggling images) and rebuild the flow.
  function rebuild() {
    inner.innerHTML = extract() + '<span id="_npcols_end" style="display:inline-block;width:0;height:0"></span>';
    inner.querySelectorAll('img').forEach(im => {
      im.addEventListener('load', scheduleRemeasure);
      im.addEventListener('error', onImgError);
    });
    page = 0;
    relayout();
    // Safety net for images that finish loading after the initial measure.
    setTimeout(remeasure, 700);
    setTimeout(remeasure, 1800);
  }

  function onImgError() {
    const fig = this.closest('._npimg');
    if (fig) fig.remove(); else this.remove();
    scheduleRemeasure();
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
    } else if (k === 'i' || k === 'I') {
      e.preventDefault();
      st.images = st.images ? 0 : 1; save(); rebuild(); flash('Images · ' + (st.images ? 'on' : 'off'));
    } else if (k === '+' || k === '=') {
      e.preventDefault();
      st.size = Math.min(MAXS, st.size + 1); save(); relayout(); flash('Size · ' + st.size + 'px');
    } else if (k === '-' || k === '_') {
      e.preventDefault();
      st.size = Math.max(MINS, st.size - 1); save(); relayout(); flash('Size · ' + st.size + 'px');
    }
  }

  rebuild();
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  return 'opened';
}

}
