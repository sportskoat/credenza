// Credenza background worker: toolbar click opens the side panel; the context
// menu queues captures in chrome.storage.local so the panel (open or not) can
// drain them. No network, no content scripts, no page access beyond the click.

chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "credenza-stash",
    title: "Stash in Credenza",
    contexts: ["page", "link", "selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const raw = info.linkUrl || info.selectionText || info.pageUrl;
  if (!raw) return;
  const title = !info.linkUrl && !info.selectionText && tab && tab.title ? tab.title : "";
  const store = await chrome.storage.local.get("credenza-pending");
  const pending = store["credenza-pending"] || [];
  pending.push({ raw, title, ts: Date.now() });
  await chrome.storage.local.set({ "credenza-pending": pending });
  if (tab && tab.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId });
});
