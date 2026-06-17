# 📰 Newspaper Columns

Strips any article to pure text and renders it in 3 full-screen columns — like a newspaper. Space or arrow keys turn the page. No scrolling.

Available as both a **Chrome extension** (recommended) and a **bookmarklet**.

---

## Features

- Extracts article text, strips everything else (images, ads, nav, sidebars, cookie banners, comments)
- 3-column paginated layout fills the full viewport — no vertical scrolling
- Space / → / PageDown to advance · ← / PageUp to go back · ESC to close
- Reaches the last page → closes automatically
- Toggle: run again on the same page to close the reader

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
- Lays out the result with CSS `columns: 3; column-fill: auto; height: 100vh` so content overflows horizontally
- A sentinel `<span>` at the end of the content measures total width via `getBoundingClientRect()` to compute page count
- `translateX` slides between pages

---

## Files

```
newspaper-columns/
  extension/
    manifest.json   — Chrome MV3 manifest (Alt+R shortcut)
    background.js   — Service worker: icon generation + reader injection
  bookmarklet/
    index.html      — Drag-to-bookmarks-bar installer page
  README.md
  .gitignore
```
