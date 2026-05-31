const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminAPI', {
    getUsers: () => ipcRenderer.invoke('admin.getUsers'),
    banUser: (hwid, type) => ipcRenderer.invoke('admin.banUser', hwid, type),
    
    closeWindow: () => ipcRenderer.send('window.close'),
    minimizeWindow: () => ipcRenderer.send('window.minimize'),
    maximizeWindow: () => ipcRenderer.send('window.maximize'),
    
    // API de Licenças (DRM)
    getLicenses: () => ipcRenderer.invoke('admin.getLicenses'),
    generateLicense: (durationDays) => ipcRenderer.invoke('admin.generateLicense', durationDays),
    revokeLicense: (id) => ipcRenderer.invoke('admin.revokeLicense', id),
    deleteLicense: (id) => ipcRenderer.invoke('admin.deleteLicense', id),

    getPendingPayments: () => ipcRenderer.invoke('admin.getPendingPayments'),
    approvePayment: (id) => ipcRenderer.invoke('admin.approvePayment', id)
});
