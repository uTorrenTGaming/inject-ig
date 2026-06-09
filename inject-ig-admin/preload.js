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
    approvePayment: (id) => ipcRenderer.invoke('admin.approvePayment', id),
    
    // Support & Updates
    getSupportTickets: () => ipcRenderer.invoke('admin.getSupportTickets'),
    deleteSupportTicket: (id) => ipcRenderer.invoke('admin.deleteSupportTicket', id),
    postAdminMessage: (content) => ipcRenderer.invoke('admin.postAdminMessage', content),

    // Realtime Support Chat
    getAllActiveChats: () => ipcRenderer.invoke('admin.getAllActiveChats'),
    getSupportMessages: (hwid) => ipcRenderer.invoke('admin.getSupportMessages', hwid),
    submitSupportTicket: (hwid, message, isAdmin) => ipcRenderer.invoke('admin.submitSupportTicket', hwid, message, isAdmin),
    onRealtimeSupportMessage: (callback) => ipcRenderer.on('realtime-support-message', (_event, msg) => callback(msg))
});
