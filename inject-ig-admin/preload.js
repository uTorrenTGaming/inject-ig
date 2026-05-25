const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminAPI', {
    getUsers: () => ipcRenderer.invoke('admin.getUsers'),
    banUser: (hwid, type) => ipcRenderer.invoke('admin.banUser', hwid, type),
    
    closeWindow: () => ipcRenderer.send('window.close'),
    minimizeWindow: () => ipcRenderer.send('window.minimize'),
    maximizeWindow: () => ipcRenderer.send('window.maximize')
});
