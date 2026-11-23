const form = document.getElementById('settings');
const key = document.getElementById('key');
const saved = document.getElementById('saved');

chrome.storage.local.get('apiKey').then(({ apiKey = '' }) => { key.value = apiKey; });

function flash(text) {
  saved.textContent = text;
  setTimeout(() => { if (saved.textContent === text) saved.textContent = ''; }, 2500);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const value = key.value.trim();
  if (value) {
    await chrome.storage.local.set({ apiKey: value });
    flash('Saved');
  } else {
    await chrome.storage.local.remove('apiKey');
    flash('Key removed');
  }
});

document.getElementById('clear').addEventListener('click', async () => {
  key.value = '';
  await chrome.storage.local.remove('apiKey');
  flash('Key removed');
});
