// Adds a right-click menu item: select text on any page → "Find an emoji for …".

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'emojimatch-selection',
    title: 'Find an emoji for “%s”',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'emojimatch-selection' || !info.selectionText) return;
  await chrome.storage.session.set({ pendingMessage: info.selectionText.trim() });
  try {
    // Opens the popup with the selection pre-filled (Chrome 127+).
    await chrome.action.openPopup(tab?.windowId ? { windowId: tab.windowId } : undefined);
  } catch {
    // Older Chrome: flag the toolbar icon so the user knows to click it.
    chrome.action.setBadgeBackgroundColor({ color: '#5932ac' });
    chrome.action.setBadgeText({ text: '1' });
  }
});
