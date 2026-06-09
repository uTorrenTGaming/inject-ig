const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onTerminalData: (callback) => ipcRenderer.on('terminal.incData', (_event, data) => callback(data)),
    sendTerminalKeystroke: (key) => ipcRenderer.send('terminal.keystroke', key),
    openTerminal: (dir) => ipcRenderer.invoke('system.openTerminal', dir),
    startUSBCapture: (platform, deviceId) => ipcRenderer.invoke('system.startUSBCapture', platform, deviceId),
    stopUSBCapture: () => ipcRenderer.invoke('system.stopUSBCapture'),
    onUSBFrame: (callback) => ipcRenderer.on('spectre.usbFrame', (_event, data) => callback(data)),
    
    // Window Controls
    closeWindow: () => ipcRenderer.send('window.close'),
    minimizeWindow: () => ipcRenderer.send('window.minimize'),
    maximizeWindow: () => ipcRenderer.send('window.maximize'),
    setFullscreen: (flag) => ipcRenderer.send('window.set-fullscreen', flag),
    toggleIphoneMode: (enable) => ipcRenderer.send('window.toggle-iphone-mode', enable),
    onSplashProgress: (callback) => ipcRenderer.on('splash.progress', (_event, data) => callback(data)),
    
    // System Hardware
    getNetworkTraffic: () => ipcRenderer.invoke('network.getTraffic'),
    installAIEngine: () => ipcRenderer.invoke('ai.installEngine'),
    pullAIModel: () => ipcRenderer.invoke('ai.pullModel'),
    checkAIEngine: () => ipcRenderer.invoke('ai.checkEngine'),
    sendAIMessage: (modelName, messages) => ipcRenderer.invoke('ai.sendMessage', modelName, messages),
    getGPUInfo: () => ipcRenderer.invoke('system.getGPUInfo'),
    
    onTogglePanic: (callback) => ipcRenderer.on('system.togglePanic', callback),
    
    runTool: (toolId, target) => ipcRenderer.invoke('system.runTool', toolId, target),
    
    // Novas APIs de C2 (Command & Control)
    selectLocalTargetFolder: () => ipcRenderer.invoke('c2.selectTargetFolder'),
    selectScanFolder: () => ipcRenderer.invoke('c2.selectScanFolder'),
    injectPayloadLocal: (folderPath) => ipcRenderer.invoke('c2.injectPayloadLocal', folderPath),
    createScript: (data) => ipcRenderer.invoke('api.createScript', data),
    executeLocalScript: (type, id, url, payload) => ipcRenderer.invoke('system.executeLocalScript', type, id, url, payload),
    restartBackend: () => ipcRenderer.send('backend.restart'),
    
    // PDF & File Studio
    exportReportPDF: (htmlContent) => ipcRenderer.invoke('system.exportReportPDF', htmlContent),
    convertFile: (file, format) => {
        let filePath = file;
        if (file && typeof file === 'object') {
            try {
                filePath = webUtils.getPathForFile(file);
            } catch (err) {
                filePath = file.path;
            }
        }
        return ipcRenderer.invoke('file.convert', filePath, format);
    },
    
    // Agente IG (IA)
    sendChatMessage: (text, model) => ipcRenderer.invoke('c2.sendChatMessage', text, model),
    getChatHistory: () => ipcRenderer.invoke('c2.getChatHistory'),
    saveReport: (data) => ipcRenderer.invoke('c2.saveReport', data),
    
    // Novas rotas de Deployment Mobile
    getMobileDevices: () => ipcRenderer.invoke('c2.getMobileDevices'),
    startSyslog: (deviceId, platform) => ipcRenderer.invoke('mobile.startSyslog', deviceId, platform),
    stopSyslog: () => ipcRenderer.invoke('mobile.stopSyslog'),
    onMobileSyslog: (callback) => ipcRenderer.on('mobile.syslogData', (event, data) => callback(data)),
    offMobileSyslog: () => ipcRenderer.removeAllListeners('mobile.syslogData'),
    
    // Antigos (mantidos para evitar erro caso algo chame, mas reescritos/removidos)
    buildAndDeployMobile: (folderPath, deviceId, platform) => ipcRenderer.invoke('c2.buildAndDeployMobile', folderPath, deviceId, platform),
    deploySelfAgent: (deviceId) => ipcRenderer.invoke('c2.deploySelfAgent', deviceId),
    
    // Espetor & Rede
    getLocalIp: () => ipcRenderer.invoke('c2.getLocalIp'),
    generatePublicLink: () => ipcRenderer.invoke('c2.generatePublicLink'),
    
    // Auth & Login
    getHWID: () => ipcRenderer.invoke('hwid.get'),
    authLoginOrRegister: (hwid, username, avatar_url) => ipcRenderer.invoke('auth.loginOrRegister', hwid, username, avatar_url),
    checkBanStatus: (hwid) => ipcRenderer.invoke('auth.checkBanStatus', hwid),
    activateLicense: (key, hwid) => ipcRenderer.invoke('system.activateLicense', key, hwid),
    getLicenseInfo: (hwid) => ipcRenderer.invoke('auth.getLicenseInfo', hwid),
    submitSupportTicket: (hwid, message, isAdmin = false) => ipcRenderer.invoke('system.submitSupportTicket', hwid, message, isAdmin),
    getSupportMessages: (hwid) => ipcRenderer.invoke('system.getSupportMessages', hwid),
    getAllActiveChats: () => ipcRenderer.invoke('system.getAllActiveChats'),
    onRealtimeSupportMessage: (callback) => ipcRenderer.on('realtime-support-message', (_event, msg) => callback(msg)),
    getAppUpdates: () => ipcRenderer.invoke('system.getAppUpdates'),
    
    // Auto Updater
    checkUpdate: () => ipcRenderer.send('update.check'),
    installUpdate: () => ipcRenderer.send('update.install'),
    onUpdateStatus: (callback) => ipcRenderer.on('update.status', (_event, msg) => callback(msg)),
    onUpdateProgress: (callback) => ipcRenderer.on('update.progress', (_event, progress) => callback(progress)),
    onUpdateReady: (callback) => ipcRenderer.on('update.ready', (_event, msg) => callback(msg)),
    
    // PC Module
    getSystemStats: () => ipcRenderer.invoke('pc.getSystemStats'),
    scanFolder: () => ipcRenderer.invoke('pc.scanFolder'),
    organizeFolder: () => ipcRenderer.invoke('pc.organizeFolder'),
    clearTempFiles: () => ipcRenderer.invoke('pc.clearTempFiles'),
    
    // Payments (Stripe)
    generateStripeCheckout: (nick, plan, price) => ipcRenderer.invoke('payment.generateStripeCheckout', nick, plan, price),
    checkStripeStatus: (sessionId, hwid, plan) => ipcRenderer.invoke('payment.checkStripeStatus', sessionId, hwid, plan),
    
    // Payments (Mercado Pago Static + Admin)
    registerPendingPayment: (nick, plan, hwid) => ipcRenderer.invoke('payment.registerPending', nick, plan, hwid),
    checkPendingStatus: (pendingId, hwid, plan) => ipcRenderer.invoke('payment.checkPendingStatus', pendingId, hwid, plan),

    openExternal: (url) => ipcRenderer.send('payment.openExternal', url),

    // ── Site Extractor Engine (Motor Java Autônomo) ──
    extractorStart: () => ipcRenderer.invoke('extractor.start'),
    extractorHealth: () => ipcRenderer.invoke('extractor.health'),
    extractorTelemetry: () => ipcRenderer.invoke('extractor.telemetry'),
    extractorScan: (url) => ipcRenderer.invoke('extractor.scan', url),
    extractorResult: () => ipcRenderer.invoke('extractor.result'),
    extractorDownloadItem: (category, index) => ipcRenderer.invoke('extractor.downloadItem', category, index),
    extractorDownloadCategory: (category, items) => ipcRenderer.invoke('extractor.downloadCategory', category, items),
    extractorStop: () => ipcRenderer.invoke('extractor.stop'),
});
