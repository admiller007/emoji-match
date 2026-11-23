const form = document.getElementById('settings');
const saved = document.getElementById('saved');
// Storage key → input field.
const fields = {
  apiKey: document.getElementById('key'),
  klipyKey: document.getElementById('klipy'),
  giphyKey: document.getElementById('giphy'),
};

chrome.storage.local.get(Object.keys(fields)).then(values => {
  for (const [name, input] of Object.entries(fields)) input.value = values[name] || '';
});

function flash(text) {
  saved.textContent = text;
  setTimeout(() => { if (saved.textContent === text) saved.textContent = ''; }, 2500);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const keep = {};
  const drop = [];
  for (const [name, input] of Object.entries(fields)) {
    const value = input.value.trim();
    input.value = value;
    if (value) keep[name] = value;
    else drop.push(name);
  }
  await chrome.storage.local.set(keep);
  await chrome.storage.local.remove(drop);
  flash('Saved');
});

document.getElementById('clear').addEventListener('click', async () => {
  for (const input of Object.values(fields)) input.value = '';
  await chrome.storage.local.remove(Object.keys(fields));
  flash('Keys removed');
});
