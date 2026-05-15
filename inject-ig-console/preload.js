const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onTerminalData: (callback) => ipcRenderer.on('terminal.incData', (_event, data) => callback(data)),
    sendTerminalKeystroke: (key) => ipcRenderer.send('terminal.keystroke', key),
    resizeTerminal: (size) => ipcRenderer.send('terminal.resize', size),
    
    // Novas APIs de C2 (Command & Control)
    selectLocalTargetFolder: () => ipcRenderer.invoke('c2.selectTargetFolder'),
    selectScanFolder: () => ipcRenderer.invoke('c2.selectScanFolder'),
    injectPayloadLocal: (folderPath) => ipcRenderer.invoke('c2.injectPayloadLocal', folderPath),
    saveReport: (data) => ipcRenderer.invoke('c2.saveReport', data)
});
