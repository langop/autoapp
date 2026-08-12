const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('biliApi', {
  getUserInfo: (uid) => ipcRenderer.invoke('getUserInfo', uid),
  listFavorites: () => ipcRenderer.invoke('listFavorites'),
  addFavorite: (user) => ipcRenderer.invoke('addFavorite', user),
  removeFavorite: (uid) => ipcRenderer.invoke('removeFavorite', uid),
  setFavoriteNotify: (uid, enabled) =>
    ipcRenderer.invoke('setFavoriteNotify', { uid, enabled }),
  reorderFavorites: (uids) => ipcRenderer.invoke('reorderFavorites', uids),
  getDynamics: (payload) => ipcRenderer.invoke('getDynamics', payload),
  getComments: (payload) => ipcRenderer.invoke('getComments', payload),
  getSettings: () => ipcRenderer.invoke('getSettings'),
  saveSettings: (payload) => ipcRenderer.invoke('saveSettings', payload),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-settings', listener);
    return () => ipcRenderer.removeListener('open-settings', listener);
  },
  onOpenFavoriteDynamics: (callback) => {
    const listener = (_e, payload) => callback(payload);
    ipcRenderer.on('open-favorite-dynamics', listener);
    return () => ipcRenderer.removeListener('open-favorite-dynamics', listener);
  },
  onFavoriteDynamicNotify: (callback) => {
    const listener = (_e, payload) => callback(payload);
    ipcRenderer.on('favorite-dynamic-notify', listener);
    return () => ipcRenderer.removeListener('favorite-dynamic-notify', listener);
  },
});
