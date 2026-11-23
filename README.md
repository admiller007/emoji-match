# Emojimatch for Chrome

Find the right emoji or GIF for a message, picked by an OpenRouter model, from the toolbar.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this folder.
3. Click the Emojimatch icon → **Settings** and paste your OpenRouter API key (https://openrouter.ai/keys).
4. For GIFs, also add a free KLIPY key (https://partner.klipy.com → API Keys → create a platform). A GIPHY key (https://developers.giphy.com) works too and is used only if there is no KLIPY key. New keys of both kinds allow about 100 searches an hour, and each GIF suggestion uses about 3. (Google shut down the Tenor API in June 2026, so Tenor isn't an option.)

## Use

- Click the toolbar icon (or press **Ctrl+Shift+E**, **⌘+Shift+E** on Mac), type a message and choose **Suggest emojis** (or press Ctrl+Enter). Click a result to copy it.
- **Highlight text first, then open the popup:** it reads the selection (text boxes too) and searches right away. Reopening it over the same selection shows the earlier result without sending another request. Chrome's own pages (`chrome://`, the Web Store) block this.
- Or select text on any page, right-click and choose **Find an emoji for "…"**. The popup opens with that text already filled in. On Chrome versions older than 127, the icon shows a badge instead, so click it.
- Your draft and last results stay until you close the browser. The API key and the last model you used are saved in this browser profile.

## GIFs

Switch to the **GIF** tab and choose **Find GIFs**. The model reads your message and writes 3 reaction-GIF searches (like “slow clap” or “this is fine”), each with a reason. KLIPY or GIPHY then shows up to 6 GIFs for each search.

- Click a GIF to copy it. It pastes as the animated image in rich editors (Gmail, Google Docs) and as a link everywhere else. Slack, Discord and most chats turn the link into the GIF. You can also drag a GIF straight into a message.
- The GIF tab needs a chat model (default `openai/gpt-4.1-mini`). Jev models only pick from fixed choices, so they can't write searches. The emoji and GIF tabs each remember their own model.
- The right-click menu also has **Find a GIF for “…”**.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 config: popup, settings page, right-click menu, shortcut, access to `openrouter.ai`, `api.klipy.com` and `api.giphy.com` only |
| `popup.html/css/js` | The main UI (was `index.html` + `emoji.js`) |
| `suggest.js` | Ranking logic from `server.mjs`: the Jev decision flow and chat-completions flow |
| `gifs.js` | GIF flow: the model writes searches, then KLIPY or GIPHY finds the GIFs |
| `options.html/js` | API key settings (OpenRouter, KLIPY, GIPHY) |
| `background.js` | Right-click menu (emoji and GIF) |
| `catalog.json`, `UNICODE-LICENSE.txt` | Unicode Emoji 18.0 data and its license |
