// Generate toolbar icon: 3 white columns on dark background
function setIcon() {
  try {
    const s = 128;
    const canvas = new OffscreenCanvas(s, s);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#fdf9f3';
    const colW = 18, colH = 80, top = 24, gap = 14;
    const totalW = 3 * colW + 2 * gap;
    const startX = (s - totalW) / 2;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(startX + i * (colW + gap), top, colW, colH);
    }
    chrome.action.setIcon({ imageData: ctx.getImageData(0, 0, s, s) });
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener(setIcon);
chrome.runtime.onStartup.addListener(setIcon);

// Toolbar button click (shortcut via _execute_action fires this too)
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: toggleNewspaperColumns,
  });
});

// ---------------------------------------------------------------------------
// Core reader — injected into the active tab
// ---------------------------------------------------------------------------
function toggleNewspaperColumns() {

  const ex = document.getElementById('_npcols');
  if (ex) { document.body.removeChild(ex); return; }

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

  // --- Layout ---
  const PAD = 60, GAP = 48, BARH = 44;
  const cw = window.innerWidth - PAD * 2;
  const ch = window.innerHeight - PAD * 2 - BARH;
  const pageW = cw + GAP;
  let page = 0;

  // --- Build DOM ---
  const overlay = document.createElement('div');
  overlay.id = '_npcols';
  overlay.style.cssText = 'position:fixed;inset:0;background:#fdf9f3;z-index:2147483647;overflow:hidden;';

  const clip = document.createElement('div');
  clip.style.cssText =
    `position:absolute;top:${PAD}px;left:${PAD}px;width:${cw}px;height:${ch}px;overflow:hidden;`;

  const inner = document.createElement('div');
  inner.style.cssText =
    `height:100%;columns:3;column-gap:${GAP}px;column-fill:auto;` +
    'font-family:Georgia,serif;font-size:17px;line-height:1.8;color:#1a1a1a;' +
    'orphans:4;widows:4;hyphens:auto;transition:transform .35s cubic-bezier(.4,0,.2,1);';
  inner.innerHTML = html + '<span id="_npcols_end" style="display:inline-block;width:0;height:0"></span>';

  const bar = document.createElement('div');
  bar.style.cssText =
    `position:absolute;bottom:0;left:0;right:0;height:${BARH}px;` +
    'display:flex;align-items:center;justify-content:space-between;' +
    `padding:0 ${PAD}px;font-family:-apple-system,sans-serif;font-size:12px;` +
    'color:#aaa;border-top:1px solid #e8e4dc;background:#fdf9f3;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'ESC · ✕ Close';
  closeBtn.style.cssText =
    'background:none;border:1px solid #ccc;border-radius:4px;padding:3px 10px;' +
    'cursor:pointer;font-size:12px;color:#888;font-family:inherit;';
  closeBtn.onclick = doClose;

  const hintEl = document.createElement('span');
  hintEl.textContent = '← → or Space to turn pages';

  const progEl = document.createElement('span');

  bar.append(closeBtn, hintEl, progEl);

  const styleEl = document.createElement('style');
  styleEl.textContent = [
    '#_npcols h1{font-size:1.5em;break-after:avoid;margin:0 0 0.6em;line-height:1.3}',
    '#_npcols h2{font-size:1.25em;break-after:avoid;margin:1.4em 0 0.4em;line-height:1.3}',
    '#_npcols h3,#_npcols h4{font-size:1.05em;break-after:avoid;margin:1.2em 0 0.3em}',
    '#_npcols p{margin:0 0 1em}',
    '#_npcols blockquote{border-left:3px solid #ccc;padding-left:1em;margin:0 0 1em;font-style:italic;color:#555}',
    '#_npcols a{color:inherit;text-decoration:none}',
    '#_npcols *{max-width:100%;box-sizing:border-box}',
  ].join('');

  clip.appendChild(inner);
  overlay.append(styleEl, clip, bar);
  document.body.appendChild(overlay);

  // --- Pagination ---
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

  function doClose() {
    if (document.getElementById('_npcols')) document.body.removeChild(overlay);
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!document.getElementById('_npcols')) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault(); goTo(page + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault(); goTo(page - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault(); doClose();
    }
  }

  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => requestAnimationFrame(updateProg));
}
