const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('biliApi', {
  getUserInfo: (uid) => ipcRenderer.invoke('getUserInfo', uid),
  listFavorites: () => ipcRenderer.invoke('listFavorites'),
  addFavorite: (user) => ipcRenderer.invoke('addFavorite', user),
  removeFavorite: (uid) => ipcRenderer.invoke('removeFavorite', uid),
  getDynamics: (payload) => ipcRenderer.invoke('getDynamics', payload),
  getComments: (payload) => ipcRenderer.invoke('getComments', payload),
});
