import { contextBridge, ipcRenderer } from 'electron';
const api = {
  control: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.invoke('window:control', action),
  getState: () => ipcRenderer.invoke('browser:state'),
  newTab: (isPrivate = false) => ipcRenderer.invoke('browser:new-tab', isPrivate), activateTab: (id: string) => ipcRenderer.invoke('browser:activate', id), closeTab: (id: string) => ipcRenderer.invoke('browser:close-tab', id),
  navigate: (id: string, input: string) => ipcRenderer.invoke('browser:navigate', id, input), go: (direction: 'back' | 'forward' | 'reload') => ipcRenderer.invoke('browser:go', direction), setBounds: (bounds: {x:number;y:number;width:number;height:number}, visible: boolean) => ipcRenderer.invoke('browser:bounds', bounds, visible),
  getBookmarks: () => ipcRenderer.invoke('browser:bookmarks:get'), addBookmark: (url: string, title: string) => ipcRenderer.invoke('browser:bookmarks:add', url, title), getHistory: () => ipcRenderer.invoke('browser:history:get'), getPreferences: () => ipcRenderer.invoke('browser:preferences:get'), setSearchEngine: (value: 'google'|'duckduckgo'|'bing') => ipcRenderer.invoke('browser:preferences:set-search', value), inspect: () => ipcRenderer.invoke('browser:inspect'), devtools: () => ipcRenderer.invoke('browser:devtools'), openExternal: (url: string) => ipcRenderer.invoke('browser:external', url),
  onTabs: (callback: (tabs: unknown[], activeId: string | null) => void) => { const listener = (_: Electron.IpcRendererEvent, tabs: unknown[], active: string | null) => callback(tabs, active); ipcRenderer.on('browser:tabs', listener); return () => ipcRenderer.removeListener('browser:tabs', listener); },
  onDownload: (callback: (item: unknown) => void) => { const listener = (_: Electron.IpcRendererEvent, item: unknown) => callback(item); ipcRenderer.on('browser:download', listener); return () => ipcRenderer.removeListener('browser:download', listener); },
  onFocusAddress: (callback: () => void) => { const listener = () => callback(); ipcRenderer.on('browser:focus-address', listener); return () => ipcRenderer.removeListener('browser:focus-address', listener); }
};
contextBridge.exposeInMainWorld('hubshield', api);
