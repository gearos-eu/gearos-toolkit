// GearOS — background service worker (MV3)
// Currently minimal. Reserved for future: keep-alive license checks, image proxy.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[GearOS] Extension installed v0.1.0');
});
