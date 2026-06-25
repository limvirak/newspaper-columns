# 📰 Newspaper Columns

Strips any article to pure text and renders it in full-screen newspaper columns. Space or arrow keys turn the page. No scrolling.

Available as both a **Chrome extension** (recommended) and a **bookmarklet**.

---

## Features

- Extracts article text, strips everything else (images, ads, nav, sidebars, cookie banners, comments)
- Paginated columns fill the full viewport — no vertical scrolling
- **Auto** column count scales to your window width (or pick 1–4 manually)
- Adjust **font**, **size**, **columns**, and **theme** on the fly — choices are remembered
- Re-flows automatically when you resize the window
- Reaches the last page → closes automatically
- Toggle: run again on the same page to close the reader

### Controls

| Key | Action |
|-----|--------|
| `Space` / `→` / `PageDown` | Next page |
| `←` / `PageUp` | Previous page |
| `F` | Cycle font — Serif · Sans · Iowan |
| `−` / `+` | Decrease / increase font size (13–24px) |
| `C` | Cycle columns — Auto · 1 · 2 · 3 · 4 |
| `B` | Cycle theme — Cream · White · Sepia · Night |
| `Esc` / `✕` | Close |

Settings persist via `chrome.storage` in the extension (global, across all sites) and via `localStorage` in the bookmarklet (per site).

---

## Chrome Extension

### Install

1. Download or clone this repo
2. Open Chrome → go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. The 📰 icon appears in your toolbar

### Keyboard shortcut

The default shortcut is **Alt+R**. To change it (e.g. to Opt+Cmd+R):

1. Go to `chrome://extensions/shortcuts`
2. Find **Newspaper Columns** → click the pencil icon
3. Press your preferred shortcut

> Chrome does not allow `Ctrl+Alt` combinations, so `Opt+Cmd+R` isn't available directly — use `Alt+R` or pick any other non-conflicting shortcut.

---

## Bookmarklet

1. Open `bookmarklet/index.html` in Chrome (drag the file onto a browser tab, or open via `File → Open`)
2. Drag the black **📰 Newspaper Columns** button onto your bookmarks bar
3. Navigate to any article and click the bookmark

The bookmarklet installer page also has a manual-install fallback if drag-and-drop doesn't work.

---

## How it works

- Selects the best content container (`<article>`, `.article-body`, `main`, etc.) then falls back to `<body>`
- Removes all non-text elements and noise-matched class/id nodes (ads, social, newsletter, etc.)
- Extracts `h1–h6`, `p`, and `blockquote` elements with > 30 characters of text
- Lays out the result with CSS multi-column (`column-fill: auto; height: 100vh`) so content overflows horizontally; Auto column count is `round(contentWidth / 360)`
- A sentinel `<span>` at the end of the content measures total width via `getBoundingClientRect()` to compute page count
- `translateX` slides between pages; changing font/size/columns/theme or resizing the window re-measures and re-clamps the current page

---

## Development

The reader lives in **one place** — [`src/reader.js`](src/reader.js) — and both targets are generated from it so they can never drift:

```
node build.js
```

This writes `extension/background.js` (service-worker header + the reader) and splices the minified bookmarklet into `bookmarklet/index.html`. **Don't edit the generated files by hand** — edit `src/reader.js` and rebuild. The minifier is comment-stripping only, so `reader.js` follows a few authoring rules documented at the top of the file (semicolons, single-line template literals, single quotes).

---

## Files

```
newspaper-columns/
  src/
    reader.js       — core reader (SINGLE SOURCE OF TRUTH)
  build.js          — generates the two targets below from src/reader.js
  extension/
    manifest.json   — Chrome MV3 manifest (Alt+R shortcut, storage permission)
    background.js    — GENERATED: service worker (icon + settings load + reader injection)
  bookmarklet/
    index.html       — GENERATED: drag-to-bookmarks-bar installer page
  README.md
  .gitignore
```
