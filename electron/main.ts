import { app, BrowserWindow, WebContentsView, ipcMain, session, shell } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

type TabInfo = { id: string; title: string; url: string; loading: boolean; canGoBack: boolean; canGoForward: boolean; private: boolean };
type Tab = { id: string; view: WebContentsView; private: boolean; url: string; title: string; loading: boolean };
type Bounds = { x: number; y: number; width: number; height: number };
let win: BrowserWindow;
let activeId: string | null = null;
const tabs = new Map<string, Tab>();
const downloadSessions = new WeakSet<Electron.Session>();
const historyFile = () => path.join(app.getPath('userData'), 'history.json');
const bookmarksFile = () => path.join(app.getPath('userData'), 'bookmarks.json');
const preferencesFile = () => path.join(app.getPath('userData'), 'preferences.json');
type Preferences = { searchEngine: 'google' | 'duckduckgo' | 'bing' };
const readPreferences = async (): Promise<Preferences> => { try { const value = JSON.parse(await fs.readFile(preferencesFile(), 'utf8')); if (['google','duckduckgo','bing'].includes(value.searchEngine)) return value; } catch {} return { searchEngine: 'google' }; };
let historyQueue: Promise<void> = Promise.resolve();
const writeJsonAtomically = async (file: string, data: unknown) => { const temp = `${file}.${randomUUID()}.tmp`; await fs.writeFile(temp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 }); await fs.rename(temp, file); };
const validWebUrl = (raw: string): string | null => {
  try { const url = new URL(raw); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};
const sendTabs = () => {
  if (!win || win.isDestroyed()) return;
  const state: TabInfo[] = [...tabs.values()].map(t => ({ id: t.id, title: t.title, url: t.url, loading: t.loading, canGoBack: t.view.webContents.canGoBack(), canGoForward: t.view.webContents.canGoForward(), private: t.private }));
  win.webContents.send('browser:tabs', state, activeId);
};
const setViewBounds = (bounds: Bounds, visible: boolean) => {
  const tab = activeId ? tabs.get(activeId) : undefined;
  for (const t of tabs.values()) t.view.setVisible(Boolean(visible && t === tab));
  if (visible && tab) tab.view.setBounds({ x: Math.max(0, bounds.x), y: Math.max(0, bounds.y), width: Math.max(0, bounds.width), height: Math.max(0, bounds.height) });
};
const recordVisit = (url: string, title: string) => {
  historyQueue = historyQueue.then(async () => {
    const old: Array<{ url: string; title: string; visitedAt: number }> = JSON.parse(await fs.readFile(historyFile(), 'utf8').catch(() => '[]'));
    old.unshift({ url, title, visitedAt: Date.now() });
    await writeJsonAtomically(historyFile(), old.slice(0, 500));
  }).catch(() => { /* Keep navigation available if local history storage fails. */ });
  return historyQueue;
};
function createTab(isPrivate = false, initialUrl?: string) {
  const id = randomUUID();
  const partition = isPrivate ? `temp:${id}` : 'persist:hubshield-default';
  const ses = session.fromPartition(partition);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  if (!downloadSessions.has(ses)) {
    downloadSessions.add(ses);
    ses.on('will-download', (_event, item) => {
      const payload = { filename: item.getFilename(), url: item.getURL(), received: 0, total: item.getTotalBytes(), state: 'progress' };
      item.on('updated', (_e, state) => { payload.received = item.getReceivedBytes(); payload.state = state; win.webContents.send('browser:download', payload); });
      item.once('done', (_e, state) => { payload.received = item.getReceivedBytes(); payload.state = state; win.webContents.send('browser:download', payload); });
    });
  }
  const view = new WebContentsView({ webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  const tab: Tab = { id, view, private: isPrivate, url: 'hubshield://home', title: 'Nouvel onglet', loading: false };
  tabs.set(id, tab);
  view.webContents.setWindowOpenHandler(({ url }) => { const newTab = createTab(isPrivate, validWebUrl(url) ?? undefined); activateTab(newTab.id); return { action: 'deny' }; });
  view.webContents.on('will-navigate', (event, url) => { if (!validWebUrl(url)) event.preventDefault(); });
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const primary = input.control || input.meta;
    const key = input.key.toLowerCase();
    if (primary && key === 'l') { event.preventDefault(); win.webContents.send('browser:focus-address'); }
    else if (primary && key === 't') { event.preventDefault(); const next = createTab(false); activateTab(next.id); }
    else if (primary && input.shift && key === 'n') { event.preventDefault(); const next = createTab(true); activateTab(next.id); }
    else if (primary && key === 'w') { event.preventDefault(); if (input.shift) win.close(); else closeTab(id); }
    else if (primary && key === 'r') { event.preventDefault(); view.webContents.reload(); }
    else if (input.alt && input.key === 'ArrowLeft' && view.webContents.canGoBack()) { event.preventDefault(); view.webContents.goBack(); }
    else if (input.alt && input.key === 'ArrowRight' && view.webContents.canGoForward()) { event.preventDefault(); view.webContents.goForward(); }
  });
  view.webContents.on('did-start-loading', () => { tab.loading = true; sendTabs(); });
  view.webContents.on('did-stop-loading', () => { tab.loading = false; tab.url = view.webContents.getURL(); tab.title = view.webContents.getTitle() || tab.url; sendTabs(); });
  view.webContents.on('did-navigate', (_event, url) => { tab.url = url; tab.title = view.webContents.getTitle() || url; if (!isPrivate) void recordVisit(url, tab.title); sendTabs(); });
  view.webContents.on('page-title-updated', (_event, title) => { tab.title = title; sendTabs(); });
  view.webContents.on('render-process-gone', () => { tab.title = 'Page arrêtée'; sendTabs(); });
  if (initialUrl) void view.webContents.loadURL(initialUrl);
  sendTabs();
  return tab;
}
function activateTab(id: string) {
  if (!tabs.has(id)) return;
  for (const tab of tabs.values()) { if (tab.view.webContents.isDestroyed()) continue; if (tab.id === activeId) win.contentView.removeChildView(tab.view); }
  activeId = id;
  const tab = tabs.get(id)!;
  if (!tab.view.webContents.isDestroyed() && !win.contentView.children.includes(tab.view)) win.contentView.addChildView(tab.view);
  setViewBounds(currentBounds, currentBounds.width > 0 && currentBounds.height > 0);
  sendTabs();
}
let currentBounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };
function closeTab(id: string) {
  const tab = tabs.get(id); if (!tab) return;
  if (activeId === id) win.contentView.removeChildView(tab.view);
  tabs.delete(id); tab.view.webContents.close();
  if (activeId === id) { activeId = null; const next = [...tabs.keys()].at(-1); if (next) activateTab(next); else { const fresh = createTab(); activateTab(fresh.id); } }
  sendTabs();
}
function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 920, minWidth: 880, minHeight: 600, frame: false, backgroundColor: '#09090B', title: 'HubShield', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { const safe = validWebUrl(url); if (safe) { const tab = createTab(false, safe); activateTab(tab.id); } return { action: 'deny' }; });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl); else void win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.on('resize', () => { if (activeId) setViewBounds(currentBounds, currentBounds.width > 0); });
  win.on('closed', () => { for (const tab of tabs.values()) if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close(); tabs.clear(); });
  const initial = createTab(); activateTab(initial.id);
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('window:control', (_e, action: unknown) => { if (action === 'minimize') win.minimize(); else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize(); else if (action === 'close') win.close(); });
ipcMain.handle('browser:state', () => ({ tabs: [...tabs.values()].map(t => ({ id: t.id, title: t.title, url: t.url, loading: t.loading, canGoBack: t.view.webContents.canGoBack(), canGoForward: t.view.webContents.canGoForward(), private: t.private })), activeId }));
ipcMain.handle('browser:new-tab', (_e, isPrivate: unknown) => { const tab = createTab(isPrivate === true); activateTab(tab.id); return tab.id; });
ipcMain.handle('browser:activate', (_e, id: unknown) => { if (typeof id === 'string') activateTab(id); });
ipcMain.handle('browser:close-tab', (_e, id: unknown) => { if (typeof id === 'string') closeTab(id); });
ipcMain.handle('browser:navigate', async (_e, id: unknown, input: unknown) => {
  if (typeof id !== 'string' || typeof input !== 'string' || input.length > 4096) return;
  const tab = tabs.get(id); if (!tab) return;
  const candidate = input.trim(); if (!candidate) return;
  let url = validWebUrl(candidate);
  if (!url) {
    if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(candidate) && !/\s/.test(candidate)) url = validWebUrl(`https://${candidate}`);
    else { const engine = (await readPreferences()).searchEngine; const base = engine === 'bing' ? 'https://www.bing.com/search?q=' : engine === 'duckduckgo' ? 'https://duckduckgo.com/?q=' : 'https://www.google.com/search?q='; url = `${base}${encodeURIComponent(candidate)}`; }
  }
  if (url) void tab.view.webContents.loadURL(url);
});
ipcMain.handle('browser:go', (_e, direction: unknown) => { const t = activeId ? tabs.get(activeId) : undefined; if (!t) return; if (direction === 'back' && t.view.webContents.canGoBack()) t.view.webContents.goBack(); if (direction === 'forward' && t.view.webContents.canGoForward()) t.view.webContents.goForward(); if (direction === 'reload') t.view.webContents.reload(); });
ipcMain.handle('browser:bounds', (_e, raw: unknown, visible: unknown) => {
  if (!raw || typeof raw !== 'object') return;
  const b = raw as Record<string, unknown>; const vals = ['x','y','width','height'].map(k => b[k]);
  if (vals.some(v => typeof v !== 'number' || !Number.isFinite(v))) return;
  currentBounds = { x: vals[0] as number, y: vals[1] as number, width: vals[2] as number, height: vals[3] as number };
  setViewBounds(currentBounds, visible === true);
});
const readBookmarks = async (): Promise<Array<{url:string;title:string}>> => { try { return JSON.parse(await fs.readFile(bookmarksFile(), 'utf8')); } catch { return []; } };
ipcMain.handle('browser:bookmarks:get', () => readBookmarks());
ipcMain.handle('browser:bookmarks:add', async (_e, url: unknown, title: unknown) => {
  if (typeof url !== 'string' || !validWebUrl(url) || typeof title !== 'string') return false;
  const list = await readBookmarks();
  if (!list.some(item => item.url === url)) list.push({ url, title: title.slice(0, 200) });
  await writeJsonAtomically(bookmarksFile(), list); return true;
});
ipcMain.handle('browser:history:get', async () => { try { return JSON.parse(await fs.readFile(historyFile(), 'utf8')); } catch { return []; } });
ipcMain.handle('browser:preferences:get', () => readPreferences());
ipcMain.handle('browser:preferences:set-search', async (_e, value: unknown) => { if (value !== 'google' && value !== 'duckduckgo' && value !== 'bing') return false; await writeJsonAtomically(preferencesFile(), { searchEngine: value }); return true; });
ipcMain.handle('browser:inspect', async () => { const t = activeId ? tabs.get(activeId) : undefined; if (!t) return ''; try { return await t.view.webContents.executeJavaScript('document.documentElement.outerHTML'); } catch { return ''; } });
ipcMain.handle('browser:devtools', () => { const t = activeId ? tabs.get(activeId) : undefined; t?.view.webContents.openDevTools({ mode: 'detach' }); });
ipcMain.handle('browser:external', (_e, url: unknown) => { if (typeof url === 'string' && validWebUrl(url)) void shell.openExternal(url); });
