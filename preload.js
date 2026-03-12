const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  generateCard: (data) => ipcRenderer.invoke('generate-card', data),
  saveImage: (dataUrl) => ipcRenderer.invoke('save-image', dataUrl),
  fetchModels: (apiKey) => ipcRenderer.invoke('fetch-models', apiKey),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  captureCard: (data) => ipcRenderer.invoke('capture-card', data),
  shareToX: (data) => ipcRenderer.invoke('share-to-x', data),
  shareToXText: (data) => ipcRenderer.invoke('share-to-x-text', data)
});
