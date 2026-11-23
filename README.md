# Emojimatch for Chrome

Find the right emoji for a message, ranked by an OpenRouter model, from the toolbar.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this folder.
3. Click the Emojimatch icon → **Settings** and paste your OpenRouter API key (https://openrouter.ai/keys).

## Use

- Click the toolbar icon (or press **Ctrl+Shift+E**, **⌘+Shift+E** on Mac), type a message and choose **Suggest emojis** (or press Ctrl+Enter). Click a result to copy it.
- **Highlight text first, then open the popup:** it reads the selection (text boxes too) and searches right away. Reopening it over the same selection shows the earlier result without sending another request. Chrome's own pages (`chrome://`, the Web Store) block this.
- Or select text on any page, right-click and choose **Find an emoji for "…"**. The popup opens with that text already filled in. On Chrome versions older than 127, the icon shows a badge instead, so click it.
- Your draft and last results stay until you close the browser. The API key and the last model you used are saved in this browser profile.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 config: popup, settings page, right-click menu, shortcut, access to `openrouter.ai` only |
| `popup.html/css/js` | The main UI (was `index.html` + `emoji.js`) |
| `suggest.js` | Ranking logic from `server.mjs`: the Jev decision flow and chat-completions flow |
| `options.html/js` | API key settings |
| `background.js` | Right-click menu |
| `catalog.json`, `UNICODE-LICENSE.txt` | Unicode Emoji 18.0 data and its license |
