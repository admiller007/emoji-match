import { defaultModel, loadCatalog, suggestEmojis } from './suggest.js';
import { defaultGifModel, gifProvider, suggestGifs } from './gifs.js';

const $ = selector => document.querySelector(selector);
const form = $('#picker');
const message = $('#message');
const model = $('#model');
const submit = $('#submit');
const matches = $('#matches');
const gifs = $('#gifs');
const attribution = $('#attribution');
const resultTitle = $('#result-title');
const status = $('#status');
const setup = $('#setup');
const tabs = [...document.querySelectorAll('.tab')];

const modes = {
  emoji: {
    submit: 'Suggest emojis', busy: 'Finding matches…', title: 'Suggested emojis',
    idle: 'Choose Suggest emojis to see your matches.', working: 'Ranking emojis with ',
    modelKey: 'model', resultKey: 'lastResult', list: 'models',
  },
  gif: {
    submit: 'Find GIFs', busy: 'Finding GIFs…', title: 'Suggested GIFs',
    idle: 'Choose Find GIFs to see matching GIFs.', working: 'Writing GIF searches with ',
    modelKey: 'gifModel', resultKey: 'lastGifResult', list: 'gif-models',
  },
};
let mode = 'emoji';
const models = { emoji: defaultModel, gif: defaultGifModel };
let results = {};
let apiKey = '';
let gifKeys = {};
let clientId = '';
let pending = false;

function refreshButton() {
  const keysReady = apiKey && (mode === 'emoji' || gifProvider(gifKeys));
  submit.disabled = !keysReady || pending || !message.value.trim() || !model.value.trim();
  submit.textContent = pending ? modes[mode].busy : modes[mode].submit;
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}
$('#open-settings').addEventListener('click', openSettings);

function showSetup() {
  const missing = [];
  if (!apiKey) missing.push('your OpenRouter API key');
  if (mode === 'gif' && !gifProvider(gifKeys)) missing.push('a KLIPY or GIPHY API key');
  setup.hidden = !missing.length;
  if (!missing.length) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Add ' + missing.join(' and ');
  button.addEventListener('click', openSettings);
  setup.replaceChildren(button, mode === 'emoji'
    ? ' to get AI suggestions. You can still browse the catalog below.'
    : ' to find GIFs.');
}

function copyButton(entry, type, output) {
  const { emoji, name, reason } = entry;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = type;
  button.title = 'Copy ' + name;
  button.setAttribute('aria-label', 'Copy ' + name);
  const symbol = document.createElement('span');
  if (type === 'match') symbol.className = 'symbol';
  symbol.textContent = emoji;
  button.append(symbol);
  if (type === 'match') {
    const label = document.createElement('span');
    label.className = 'name';
    label.textContent = name;
    button.append(label);
    if (reason) {
      const detail = document.createElement('span');
      detail.className = 'reason';
      detail.textContent = reason;
      button.append(detail);
    }
  }
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(emoji);
      output.textContent = 'Copied ' + emoji;
    } catch {
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(symbol);
      selection.removeAllRanges();
      selection.addRange(range);
      output.textContent = 'Emoji selected. Use your copy shortcut.';
    }
  });
  return button;
}

// Copies the GIF as an image for rich editors (Gmail, Docs) and as a link everywhere else
// (Slack, Discord and most chats turn the link into the GIF).
function gifButton(gif) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gif';
  button.title = gif.title;
  button.setAttribute('aria-label', 'Copy GIF: ' + gif.title);
  const image = document.createElement('img');
  image.src = gif.preview;
  image.alt = '';
  image.loading = 'lazy';
  image.referrerPolicy = 'no-referrer';
  button.append(image);
  button.addEventListener('click', async () => {
    const html = document.createElement('img');
    html.src = gif.url;
    html.alt = gif.title;
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html.outerHTML], { type: 'text/html' }),
        'text/plain': new Blob([gif.url], { type: 'text/plain' }),
      })]);
      status.textContent = 'Copied “' + gif.title + '”. Paste it into a chat or email.';
    } catch {
      try {
        await navigator.clipboard.writeText(gif.url);
        status.textContent = 'Copied the GIF link.';
      } catch {
        status.textContent = 'Could not copy. Drag the GIF into your message instead.';
      }
    }
  });
  return button;
}

function showResult(result) {
  status.textContent = result.suggestions.length
    ? 'Ranked by ' + result.model + ' · click an emoji to copy'
    : 'The model didn’t find a close match. Try rephrasing or switching models.';
  matches.replaceChildren(...result.suggestions.map(entry => copyButton(entry, 'match', status)));
}

function showGifResult(result) {
  const groups = result.groups.filter(group => group.gifs.length);
  status.textContent = groups.length
    ? 'Searches by ' + result.model + ' · click a GIF to copy it'
    : 'No GIFs turned up for this message. Try rephrasing or switching models.';
  gifs.replaceChildren(...groups.map(group => {
    const section = document.createElement('section');
    section.className = 'gif-group';
    const heading = document.createElement('h3');
    heading.textContent = '“' + group.query + '”';
    section.append(heading);
    if (group.reason) {
      const reason = document.createElement('p');
      reason.className = 'reason';
      reason.textContent = group.reason;
      section.append(reason);
    }
    const grid = document.createElement('div');
    grid.className = 'gif-grid';
    grid.append(...group.gifs.map(gifButton));
    section.append(grid);
    return section;
  }));
  attribution.textContent = 'GIFs powered by ' + result.provider;
  attribution.hidden = !groups.length;
}

function clearResults() {
  matches.replaceChildren();
  gifs.replaceChildren();
  attribution.hidden = true;
  status.textContent = modes[mode].idle;
}

function render(result) {
  if (!result) return clearResults();
  if (mode === 'emoji') showResult(result);
  else showGifResult(result);
}

// Results and the draft survive the popup closing for the rest of the browser session.
const session = chrome.storage.session;
function saveDraft() {
  // Save right away: the popup can close at any moment.
  session.set({ draft: message.value });
}

let revision = 0;
function edit() {
  revision++;
  results = {};
  session.remove(['lastResult', 'lastGifResult']);
  clearResults();
  saveDraft();
  refreshButton();
}

function setMode(next, remember = true) {
  if (!modes[next]) next = 'emoji';
  revision++; // A request still running in the other mode won't draw over this one.
  mode = next;
  for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.tab === mode));
  for (const element of document.querySelectorAll('[data-mode]')) element.hidden = element.dataset.mode !== mode;
  model.value = models[mode];
  model.setAttribute('list', modes[mode].list);
  resultTitle.textContent = modes[mode].title;
  render(results[mode]);
  showSetup();
  refreshButton();
  if (remember) chrome.storage.local.set({ mode });
}
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab !== mode) setMode(tab.dataset.tab);
  });
}

message.addEventListener('input', edit);
model.addEventListener('input', () => {
  models[mode] = model.value;
  edit();
});
message.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    form.requestSubmit();
  }
});
for (const example of document.querySelectorAll('.example')) {
  example.addEventListener('click', () => {
    message.value = example.dataset.message;
    edit();
    message.focus();
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  const requestMode = mode;
  const requestedModel = model.value.trim();
  const requestedMessage = message.value;
  const requestRevision = revision;
  pending = true;
  refreshButton();
  clearResults();
  status.textContent = modes[requestMode].working + requestedModel + '…';
  try {
    chrome.storage.local.set({ [modes[requestMode].modelKey]: requestedModel });
    const result = requestMode === 'emoji'
      ? await suggestEmojis(apiKey, requestedModel, requestedMessage)
      : await suggestGifs(apiKey, gifProvider(gifKeys), requestedModel, requestedMessage, clientId);
    if (requestRevision !== revision) return;
    // Remember what was asked so reopening over the same selection doesn't spend another request.
    const saved = { ...result, message: requestedMessage, requestedModel };
    results[requestMode] = saved;
    render(saved);
    session.set({ [modes[requestMode].resultKey]: saved });
  } catch (error) {
    if (requestRevision === revision) status.textContent = error.message || 'Could not get suggestions.';
  } finally {
    pending = false;
    refreshButton();
  }
});

// Runs inside the page: returns highlighted text, including text selected inside a text box.
function readSelection() {
  const field = document.activeElement;
  if (field && /^(TEXTAREA|INPUT)$/.test(field.tagName) && typeof field.selectionStart === 'number') {
    const text = field.value.slice(field.selectionStart, field.selectionEnd);
    if (text.trim()) return text;
  }
  return String(window.getSelection() || '');
}

// Reads the selection from the tab the popup was opened over. activeTab grants access
// when the user clicks the icon or uses the shortcut; pages like chrome:// stay off limits.
async function getPageSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return '';
    let found;
    try {
      found = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: readSelection });
    } catch {
      found = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readSelection });
    }
    const text = found.map(entry => entry?.result).find(value => typeof value === 'string' && value.trim());
    return text ? text.trim().slice(0, 1200) : '';
  } catch {
    return '';
  }
}

async function init() {
  const [local, { draft = '', lastResult, lastGifResult, pendingMessage, pendingMode }] = await Promise.all([
    chrome.storage.local.get(['apiKey', 'model', 'gifModel', 'mode', 'klipyKey', 'giphyKey', 'clientId']),
    session.get(['draft', 'lastResult', 'lastGifResult', 'pendingMessage', 'pendingMode']),
  ]);
  apiKey = local.apiKey || '';
  gifKeys = { klipyKey: local.klipyKey || '', giphyKey: local.giphyKey || '' };
  // A random ID that KLIPY asks for to tell users apart; it carries nothing about you.
  clientId = local.clientId || crypto.randomUUID();
  if (!local.clientId) chrome.storage.local.set({ clientId });
  models.emoji = local.model || defaultModel;
  models.gif = local.gifModel || defaultGifModel;
  results = { emoji: lastResult, gif: lastGifResult };

  if (pendingMessage) {
    await session.remove(['pendingMessage', 'pendingMode']);
    chrome.action.setBadgeText({ text: '' });
  }
  // The right-click menu picks the tab; otherwise reopen where you left off.
  setMode(pendingMessage && pendingMode ? pendingMode : local.mode, Boolean(pendingMessage && pendingMode));

  // Right-click menu text wins, then whatever is highlighted on the page.
  const selected = pendingMessage ? pendingMessage.slice(0, 1200) : await getPageSelection();
  const last = results[mode];
  const alreadyRanked = last && last.message === selected && last.requestedModel === model.value;
  if (selected && !alreadyRanked) {
    message.value = selected;
    edit();
    if (!submit.disabled) form.requestSubmit();
  } else {
    message.value = draft;
    refreshButton();
  }
  message.focus();
  message.setSelectionRange(message.value.length, message.value.length);
}
init();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(changes.apiKey || changes.klipyKey || changes.giphyKey)) return;
  if (changes.apiKey) apiKey = changes.apiKey.newValue || '';
  if (changes.klipyKey) gifKeys.klipyKey = changes.klipyKey.newValue || '';
  if (changes.giphyKey) gifKeys.giphyKey = changes.giphyKey.newValue || '';
  showSetup();
  refreshButton();
});

const library = $('#library');
const search = $('#search');
const catalogStatus = $('#catalog-status');
const catalog = $('#catalog');
const more = $('#more');
const pageSize = 96;
let entries;
let filtered = [];
let shown = 0;
let loading = false;

function showPage() {
  const page = filtered.slice(shown, shown + pageSize);
  catalog.append(...page.map(([emoji, name]) => copyButton({ emoji, name }, 'catalog-item', catalogStatus)));
  shown += page.length;
  catalogStatus.textContent = filtered.length
    ? 'Showing ' + shown.toLocaleString() + ' of ' + filtered.length.toLocaleString() + ' emoji'
    : 'No emojis match that search.';
  more.hidden = shown >= filtered.length;
}

function applySearch() {
  if (!entries) return;
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  filtered = entries.filter(entry => words.every(word => entry.join(' ').toLowerCase().includes(word)));
  shown = 0;
  catalog.replaceChildren();
  showPage();
}

library.addEventListener('toggle', async () => {
  if (!library.open || entries || loading) return;
  loading = true;
  catalogStatus.textContent = 'Loading catalog…';
  try {
    ({ emoji: entries } = await loadCatalog());
    applySearch();
  } catch {
    catalogStatus.textContent = 'Could not load the catalog. Close and reopen this section to retry.';
  } finally {
    loading = false;
  }
});
search.addEventListener('input', applySearch);
more.addEventListener('click', () => {
  const before = shown;
  showPage();
  catalog.children[before]?.focus();
});
