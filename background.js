// Adds right-click menu items: select text on any page → "Find an emoji / a GIF for …".

const menus = {
  'emojimatch-selection': { mode: 'emoji', title: 'Find an emoji for “%s”' },
  'emojimatch-gif': { mode: 'gif', title: 'Find a GIF for “%s”' },
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, { title }] of Object.entries(menus)) {
      chrome.contextMenus.create({ id, title, contexts: ['selection'] });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menu = menus[info.menuItemId];
  if (!menu || !info.selectionText) return;
  await chrome.storage.session.set({ pendingMessage: info.selectionText.trim(), pendingMode: menu.mode });
  try {
    // Opens the popup with the selection pre-filled (Chrome 127+).
    await chrome.action.openPopup(tab?.windowId ? { windowId: tab.windowId } : undefined);
  } catch {
    // Older Chrome: flag the toolbar icon so the user knows to click it.
    chrome.action.setBadgeBackgroundColor({ color: '#5932ac' });
    chrome.action.setBadgeText({ text: '1' });
  }
});
