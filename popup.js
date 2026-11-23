import { defaultModel, loadCatalog, suggestEmojis } from './suggest.js';

const $ = selector => document.querySelector(selector);
const form = $('#picker');
const message = $('#message');
const model = $('#model');
const submit = $('#submit');
const matches = $('#matches');
const status = $('#status');
const setup = $('#setup');
const idleStatus = 'Choose Suggest emojis to see your matches.';
let apiKey = '';
let pending = false;

function refreshButton() {
  submit.disabled = !apiKey || pending || !message.value.trim() || !model.value.trim();
  submit.textContent = pending ? 'Finding matches…' : 'Suggest emojis';
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}
$('#open-settings').addEventListener('click', openSettings);

function showSetup() {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Add your OpenRouter API key';
  button.addEventListener('click', openSettings);
  setup.replaceChildren(button, ' to get AI suggestions. You can still browse the catalog below.');
  setup.hidden = false;
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

function showResult(result) {
  status.textContent = result.suggestions.length
    ? 'Ranked by ' + result.model + ' · click an emoji to copy'
    : 'The model didn’t find a close match. Try rephrasing or switching models.';
  matches.replaceChildren(...result.suggestions.map(entry => copyButton(entry, 'match', status)));
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
  matches.replaceChildren();
  status.textContent = idleStatus;
  session.remove('lastResult');
  saveDraft();
  refreshButton();
}
message.addEventListener('input', edit);
model.addEventListener('input', edit);
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
  const requestedModel = model.value.trim();
  const requestedMessage = message.value;
  const requestRevision = revision;
  pending = true;
  refreshButton();
  matches.replaceChildren();
  status.textContent = 'Ranking emojis with ' + requestedModel + '…';
  try {
    chrome.storage.local.set({ model: requestedModel });
    const result = await suggestEmojis(apiKey, requestedModel, requestedMessage);
    if (requestRevision !== revision) return;
    showResult(result);
    // Remember what was asked so reopening over the same selection doesn't spend another request.
    session.set({ lastResult: { ...result, message: requestedMessage, requestedModel } });
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
    let results;
    try {
      results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: readSelection });
    } catch {
      results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readSelection });
    }
    const text = results.map(entry => entry?.result).find(value => typeof value === 'string' && value.trim());
    return text ? text.trim().slice(0, 1200) : '';
  } catch {
    return '';
  }
}

async function init() {
  const [{ apiKey: key = '', model: savedModel = '' }, { draft = '', lastResult, pendingMessage }] =
    await Promise.all([chrome.storage.local.get(['apiKey', 'model']), session.get(['draft', 'lastResult', 'pendingMessage'])]);
  apiKey = key;
  model.value = savedModel || defaultModel;
  if (!apiKey) showSetup();

  if (pendingMessage) {
    await session.remove('pendingMessage');
    chrome.action.setBadgeText({ text: '' });
  }
  // Right-click menu text wins, then whatever is highlighted on the page.
  const selected = pendingMessage ? pendingMessage.slice(0, 1200) : await getPageSelection();
  const alreadyRanked = lastResult && lastResult.message === selected && lastResult.requestedModel === model.value;
  if (selected && !alreadyRanked) {
    message.value = selected;
    edit();
    if (!submit.disabled) form.requestSubmit();
  } else {
    message.value = draft;
    if (lastResult) showResult(lastResult);
    refreshButton();
  }
  message.focus();
  message.setSelectionRange(message.value.length, message.value.length);
}
init();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.apiKey) {
    apiKey = changes.apiKey.newValue || '';
    setup.hidden = Boolean(apiKey);
    if (!apiKey) showSetup();
    refreshButton();
  }
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
