const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onTerminalData: (callback) => ipcRenderer.on('terminal.incData', (_event, data) => callback(data)),
    sendTerminalKeystroke: (key) => ipcRenderer.send('terminal.keystroke', key),
    openTerminal: (dir) => ipcRenderer.invoke('system.openTerminal', dir),
    startUSBCapture: () => ipcRenderer.invoke('system.startUSBCapture'),
    stopUSBCapture: () => ipcRenderer.invoke('system.stopUSBCapture'),
    onUSBFrame: (callback) => ipcRenderer.on('spectre.usbFrame', (_event, data) => callback(data)),
    
    // Window Controls
    closeWindow: () => ipcRenderer.send('window.close'),
    minimizeWindow: () => ipcRenderer.send('window.minimize'),
    maximizeWindow: () => ipcRenderer.send('window.maximize'),
    
    // System Hardware
    getGPUInfo: () => ipcRenderer.invoke('system.getGPUInfo'),
    
    // Novas APIs de C2 (Command & Control)
    selectLocalTargetFolder: () => ipcRenderer.invoke('c2.selectTargetFolder'),
    selectScanFolder: () => ipcRenderer.invoke('c2.selectScanFolder'),
    injectPayloadLocal: (folderPath) => ipcRenderer.invoke('c2.injectPayloadLocal', folderPath),
    saveReport: (data) => ipcRenderer.invoke('c2.saveReport', data),
    
    // Novas rotas de Deployment Mobile
    getMobileDevices: () => ipcRenderer.invoke('c2.getMobileDevices'),
    buildAndDeployMobile: (folderPath, deviceId, platform) => ipcRenderer.invoke('c2.buildAndDeployMobile', folderPath, deviceId, platform),
    deploySelfAgent: (deviceId) => ipcRenderer.invoke('c2.deploySelfAgent', deviceId),
    
    // Espetor & Rede
    getLocalIp: () => ipcRenderer.invoke('c2.getLocalIp'),
    generatePublicLink: () => ipcRenderer.invoke('c2.generatePublicLink'),
    
    // Auth & Login
    getHWID: () => ipcRenderer.invoke('hwid.get'),
    authLoginOrRegister: (hwid, username, avatar_url) => ipcRenderer.invoke('auth.loginOrRegister', hwid, username, avatar_url),
    checkBanStatus: (hwid) => ipcRenderer.invoke('auth.checkBanStatus', hwid),
    
    // Auto Updater
    checkUpdate: () => ipcRenderer.send('update.check'),
    installUpdate: () => ipcRenderer.send('update.install'),
    onUpdateStatus: (callback) => ipcRenderer.on('update.status', (_event, msg) => callback(msg)),
    onUpdateProgress: (callback) => ipcRenderer.on('update.progress', (_event, progress) => callback(progress)),
    onUpdateReady: (callback) => ipcRenderer.on('update.ready', (_event, msg) => callback(msg))
});
