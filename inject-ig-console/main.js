require('dotenv').config();
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const http = require('http');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const db = require('./src/db');
const { machineIdSync } = require('node-machine-id');

// ═════ ACELERAÇÃO GRÁFICA EXTREMA ═════
// app.commandLine.appendSwitch('enable-gpu-rasterization');
// app.commandLine.appendSwitch('enable-zero-copy');
// app.commandLine.appendSwitch('ignore-gpu-blocklist');
// app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
// app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');
// app.commandLine.appendSwitch('disable-software-rasterizer');


// ═════ STATE ═════
let mainWindow = null;
let splashWindow = null;
let backendProcess = null;

// ═════ PATH HELPERS ═════
const isPackaged = app.isPackaged;

/**
 * Returns the absolute path to the bundled backend JAR.
 * When packaged: resources are inside <app>.app/Contents/Resources/backend/
 * When dev: ../Seguranca/inject-ig-core.jar (relative to console folder)
 */
function getJarPath() {
    if (isPackaged) {
        return path.join(process.resourcesPath, 'backend', 'core.jar');
    }
    // Dev mode: look one level up for the shared JAR
    const devJar = path.join(__dirname, 'backend', 'core.jar');
    if (fs.existsSync(devJar)) return devJar;
    return path.join(__dirname, '../inject-ig-core.jar');
}

function getDataDir() {
    return path.join(app.getPath('userData'), 'inject-ig-data');
}

// ═════ SYSTEM PATH (includes homebrew, etc.) ═════
const ENV_PATH = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    'C:\\Program Files\\Java\\jdk-21\\bin',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot\\bin',
    process.env.PATH || ''
].join(process.platform === 'win32' ? ';' : ':');

// ═════ SPLASH WINDOW ═════
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 450,
        height: 600,
        backgroundColor: '#07080d',
        // transparent: false,
        // frame: false,
        show: true,
        resizable: true,
        center: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-splash.js')
        }
    });

    splashWindow.loadFile('splash.html');

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function sendSplashProgress(step, progress, message) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash.progress', { step, progress, message });
    }
}

// ═════ MAIN APP WINDOW ═════
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 600,
        show: true, // Force show for debugging
        backgroundColor: '#07080d',
        // transparent: true,
        // vibrancy: process.platform === 'darwin' ? 'fullscreen-ui' : undefined,
        // visualEffectState: 'active',
        titleBarStyle: 'hiddenInset',
        // frame: false,
        alwaysOnTop: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        // Main window is loaded — will be shown after backend is ready
    });

    // ── IPC Auth ─────────────────────────────────────────────────────────────
    // ── IPC Auth (HWID Base) ──────────────────────────────────────────────────
    ipcMain.handle('hwid.get', async () => {
        try {
            return machineIdSync();
        } catch (e) {
            console.error('HWID Error:', e);
            return 'UNKNOWN_HWID_' + Date.now();
        }
    });

    ipcMain.handle('auth.loginOrRegister', async (event, hwid, username, avatar_url) => {
        try {
            // First check if user is banned
            const userCheck = await db.findUserByHWID(hwid);
            if (userCheck && userCheck.is_banned) {
                return { success: false, banned: true, message: 'Seu computador foi banido.' };
            }
            
            const os_type = process.platform; // 'darwin', 'win32', 'linux'

            // If username is provided, register/update
            if (username) {
                const user = await db.registerOrUpdateUser(hwid, username, avatar_url, os_type);
                return { success: true, user };
            }

            // If no username provided (auto-login attempt), return user if exists
            if (userCheck) {
                return { success: true, user: userCheck };
            }

            return { success: false, needsRegistration: true };
        } catch (e) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('auth.checkBanStatus', async (event, hwid) => {
        try {
            return await db.checkBanStatus(hwid);
        } catch (e) {
            console.error('Error checking ban status:', e);
            return false;
        }
    });

    ipcMain.handle('system.getGPUInfo', async () => {
        try {
            return await app.getGPUInfo('complete');
        } catch (e) {
            console.error('GPU Info Error:', e);
            return null;
        }
    });

    // ── IPC Window Controls ──────────────────────────────────────────────────
    ipcMain.on('window.close', () => { if (mainWindow) mainWindow.close(); });
    ipcMain.on('window.minimize', () => { if (mainWindow) mainWindow.minimize(); });
    ipcMain.on('window.maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            else mainWindow.maximize();
        }
    });

    // ── Terminal Smart Shell ─────────────────────────────────────────────────
    ipcMain.on('terminal.keystroke', (event, command) => {
        if (!command || command.trim() === '') return;

        if (command === 'exit_app') { app.quit(); return; }
        if (command === 'min_app') { mainWindow && mainWindow.minimize(); return; }

        const terminalCwd = isPackaged
            ? app.getPath('userData')
            : path.join(__dirname, '../inject-ig-engine');

        const childProc = exec(command, {
            cwd: terminalCwd,
            env: { ...process.env, PATH: ENV_PATH }
        });

        childProc.stdout.on('data', (data) => {
            if (mainWindow && !mainWindow.isDestroyed())
                mainWindow.webContents.send('terminal.incData', data.toString());
        });
        childProc.stderr.on('data', (data) => {
            if (mainWindow && !mainWindow.isDestroyed())
                mainWindow.webContents.send('terminal.incData', '\x1b[31m' + data.toString() + '\x1b[0m');
        });
        childProc.on('error', (err) => {
            if (mainWindow && !mainWindow.isDestroyed())
                mainWindow.webContents.send('terminal.incData', `\x1b[31m[IG ERROR] ${err.message}\x1b[0m\n`);
        });
    });

    // ── C2 Handlers ─────────────────────────────────────────────────────────
    ipcMain.handle('c2.selectTargetFolder', async () => {
        const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Selecione a pasta do projeto Alvo' });
        return r.canceled ? null : r.filePaths[0];
    });

    ipcMain.handle('c2.selectScanFolder', async () => {
        const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Selecione a pasta para Varredura' });
        return r.canceled ? null : r.filePaths[0];
    });

    ipcMain.handle('c2.injectPayloadLocal', async (event, folderPath) => {
        try {
            const targets = [
                path.join(folderPath, 'public', 'index.html'),
                path.join(folderPath, 'index.html'),
                path.join(folderPath, 'pages', '_document.js'),
                path.join(folderPath, 'pages', '_document.tsx'),
            ];
            const targetFile = targets.find(fs.existsSync);
            if (!targetFile) return { success: false, message: 'Nenhum arquivo alvo encontrado.' };

            const overlayDist = isPackaged
                ? path.join(process.resourcesPath, 'overlay-ui/dist/assets')
                : path.join(__dirname, '../inject-ig-engine/overlay-ui/dist/assets');
            if (!fs.existsSync(overlayDist)) return { success: false, message: 'Build do overlay-ui não encontrado.' };

            const files = fs.readdirSync(overlayDist);
            const jsFile = files.find(f => f.endsWith('.js'));
            const cssFile = files.find(f => f.endsWith('.css'));
            const jsContent = jsFile ? fs.readFileSync(path.join(overlayDist, jsFile), 'utf8') : '';
            const cssContent = cssFile ? fs.readFileSync(path.join(overlayDist, cssFile), 'utf8') : '';

            const payload = `\n<!-- INJECT-IG MOD MENU INJECTION -->\n<style>\n${cssContent}\n</style>\n<script>\n${jsContent}\n</script>\n`;
            let content = fs.readFileSync(targetFile, 'utf8');
            if (content.includes('INJECT-IG MOD MENU')) return { success: false, message: 'Já injetado!' };
            content = content.includes('</body>') ? content.replace('</body>', payload + '</body>') : content + payload;
            fs.writeFileSync(targetFile, content);
            return { success: true, message: `Injetado com sucesso em:\n${targetFile}`, file: targetFile };
        } catch (e) {
            return { success: false, message: 'Erro: ' + e.message };
        }
    });

    ipcMain.handle('c2.getMobileDevices', async () => {
        return new Promise((resolve) => {
            let devices = [];
            let done = 0;
            const finish = () => { if (++done >= 2) resolve(devices.length ? { success: true, devices } : { success: false, message: 'Nenhum dispositivo detectado.', devices: [] }); };

            exec('adb devices', { env: { ...process.env, PATH: ENV_PATH } }, (err, stdout) => {
                if (!err && stdout) {
                    stdout.split('\n').slice(1).map(l => l.trim()).filter(l => l).forEach(line => {
                        const [id, status] = line.split('\t');
                        if (id && status) devices.push({ id, status, platform: 'android', name: `Android (${id})` });
                    });
                }
                finish();
            });

            if (process.platform === 'darwin') {
                exec('system_profiler SPUSBDataType', (err, stdout) => {
                    if (!err && stdout) {
                        const blocks = stdout.split(/(?=\n\s*(?:iPhone|iPad):)/);
                        for (const block of blocks) {
                            const typeMatch = block.match(/^\s*(iPhone|iPad):/);
                            const serialMatch = block.match(/Serial Number:\s*([A-Za-z0-9]+)/);
                            if (typeMatch && serialMatch) {
                                let id = serialMatch[1];
                                if (id.length === 24) id = id.substring(0, 8) + '-' + id.substring(8);
                                devices.push({ id, status: 'online', platform: 'ios', name: typeMatch[1] + ' (USB)' });
                            }
                        }
                    }
                    finish();
                });
            } else {
                finish();
            }
        });
    });

    ipcMain.handle('c2.buildAndDeployMobile', async (event, folderPath, deviceId, platform) => {
        if (!folderPath) return { success: false, message: 'Selecione o Projeto Alvo na aba Injeção primeiro.' };
        if (!deviceId) return { success: false, message: 'Nenhum dispositivo USB selecionado.' };
        if (!platform) platform = 'android';
        if (platform === 'ios' && process.platform !== 'darwin') return { success: false, message: 'Compilação iOS só em Mac.' };

        return new Promise((resolve) => {
            const capInit = `if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then npm init -y && npm install @capacitor/core @capacitor/cli && npx --yes cap init "App Inject" "com.inject.app" --web-dir .; fi`;
            let script = platform === 'android'
                ? `cd "${folderPath}" && ${capInit} && npx --yes cap add android && npx --yes cap sync android && npx --yes cap run android --target ${deviceId}`
                : `cd "${folderPath}" && ${capInit} && npx --yes cap add ios && npx --yes cap sync ios && npx --yes cap run ios --target ${deviceId}`;

            const child = exec(script, { env: { ...process.env, PATH: ENV_PATH } });

            child.stdout.on('data', d => mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.send('terminal.incData', '\x1b[35m[MOBILE]\x1b[0m ' + d.toString().replace(/\n/g, '\r\n')));
            child.stderr.on('data', d => mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.send('terminal.incData', '\x1b[31m[MOBILE ERRO]\x1b[0m ' + d.toString().replace(/\n/g, '\r\n')));
            child.on('close', code => resolve(code === 0
                ? { success: true, message: `Sucesso! App injetado via USB → ${platform.toUpperCase()} ${deviceId}` }
                : { success: false, message: `Falha no Build (Exit: ${code})` }));
        });
    });

    ipcMain.handle('c2.deploySelfAgent', async (event, deviceId) => {
        if (!deviceId) return { success: false, message: 'Nenhum dispositivo selecionado.' };
        if (process.platform !== 'darwin') return { success: false, message: 'Sideload iOS só em Mac.' };
        return new Promise((resolve) => {
            const child = exec(`npx cap sync ios && npx cap run ios --target ${deviceId}`, { cwd: __dirname });
            child.stdout.on('data', d => mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.send('terminal.incData', '\x1b[36m[AGENT]\x1b[0m ' + d.toString().replace(/\n/g, '\r\n')));
            child.stderr.on('data', d => mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.send('terminal.incData', '\x1b[31m[AGENT ERRO]\x1b[0m ' + d.toString().replace(/\n/g, '\r\n')));
            child.on('close', code => resolve(code === 0
                ? { success: true, message: `Agente instalado no iPhone ${deviceId}! (Validade 7 dias)` }
                : { success: false, message: `Falha ao instalar o Agente (Exit: ${code})` }));
        });
    });

    ipcMain.handle('c2.saveReport', async (event, data) => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Salvar Relatório', defaultPath: 'inject-ig-report.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (filePath) { fs.writeFileSync(filePath, data); return { success: true, message: 'Salvo em: ' + filePath }; }
        return { success: false, message: 'Cancelado' };
    });

    ipcMain.handle('c2.getLocalIp', async () => {
        const ifaces = os.networkInterfaces();
        for (const name of Object.keys(ifaces)) {
            for (const iface of ifaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) return iface.address;
            }
        }
        return '127.0.0.1';
    });

    ipcMain.handle('c2.generatePublicLink', () => new Promise((resolve) => {
        const child = exec('npx --yes localtunnel --port 8080', { cwd: __dirname });
        child.stdout.on('data', d => {
            const t = d.toString();
            if (t.includes('your url is:')) resolve({ success: true, url: t.split('your url is:')[1].trim() });
        });
        child.on('error', e => resolve({ success: false, message: e.message }));
        setTimeout(() => resolve({ success: false, message: 'Timeout ao gerar túnel.' }), 10000);
    }));

    // ── USB Screen Capture ───────────────────────────────────────────────────
    let usbCaptureProcess = null;

    ipcMain.handle('system.startUSBCapture', () => new Promise((resolve) => {
        if (usbCaptureProcess) { usbCaptureProcess.kill(); usbCaptureProcess = null; }

        const scriptPath = isPackaged
            ? path.join(process.resourcesPath, 'engine', 'usb_capture.py')
            : path.join(__dirname, 'engine', 'usb_capture.py');

        const tmpFile = path.join(os.tmpdir(), 'inject_ig_screen.png');

        usbCaptureProcess = spawn('python3', [scriptPath], {
            env: { ...process.env, PATH: ENV_PATH }
        });

        let resolved = false;
        usbCaptureProcess.stdout.on('data', (data) => {
            for (const line of data.toString().split('\n')) {
                const t = line.trim();
                if (t === 'FRAME') {
                    if (!resolved) { resolved = true; resolve({ success: true }); }
                    try {
                        const buf = fs.readFileSync(tmpFile);
                        if (mainWindow && !mainWindow.isDestroyed())
                            mainWindow.webContents.send('spectre.usbFrame', 'data:image/png;base64,' + buf.toString('base64'));
                    } catch (e) {}
                } else if (t.startsWith('INFO: Conectado')) {
                    if (mainWindow && !mainWindow.isDestroyed())
                        mainWindow.webContents.send('terminal.incData', `\x1b[32m[usb]\x1b[0m ${t}\r\n`);
                } else if (t.startsWith('ERROR:') && !resolved) {
                    resolved = true;
                    resolve({ success: false, message: t.replace('ERROR:', '').trim() });
                }
            }
        });
        usbCaptureProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg && !msg.includes('WARNING') && mainWindow && !mainWindow.isDestroyed())
                mainWindow.webContents.send('terminal.incData', `\x1b[33m[usb] ${msg}\x1b[0m\r\n`);
        });
        usbCaptureProcess.on('close', (code) => {
            if (!resolved) { resolved = true; resolve({ success: false, message: `Processo encerrado (${code}). iPhone desbloqueado?` }); }
        });
        setTimeout(() => {
            if (!resolved) { resolved = true; resolve({ success: false, message: 'Timeout 25s. Verifique cabo USB.' }); }
        }, 25000);
    }));

    ipcMain.handle('system.stopUSBCapture', () => {
        if (usbCaptureProcess) { usbCaptureProcess.kill(); usbCaptureProcess = null; }
        return { success: true };
    });
}

// ═════ AUTO UPDATER ═════
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

function setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update.status', 'Verificando atualizações...');
    });
    autoUpdater.on('update-available', (info) => {
        log.info('Update available.');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update.status', 'Atualização disponível. Baixando...');
    });
    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available.');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update.status', 'O sistema está atualizado.');
    });
    autoUpdater.on('error', (err) => {
        log.info('Error in auto-updater. ' + err);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update.status', 'Erro na atualização: ' + err.message);
    });
    autoUpdater.on('download-progress', (progressObj) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update.progress', progressObj);
    });
    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update.ready', 'Atualização pronta para instalar.');
    });

    ipcMain.on('update.check', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
    
    ipcMain.on('update.install', () => {
        autoUpdater.quitAndInstall();
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// BACKEND AUTO-STARTER
// Starts the embedded Java Spring Boot JAR silently.
// Shows splash screen while waiting for the API to be ready.
// ═════════════════════════════════════════════════════════════════════════════

function waitForApi(maxAttempts, interval, onReady, onFail) {
    let attempts = 0;
    const check = () => {
        attempts++;
        const req = http.request({ hostname: '127.0.0.1', port: 8080, path: '/api/auth/admin/users', method: 'GET', timeout: 2000 }, (res) => {
            // Any response (even 403) means the server is up
            onReady();
        });
        req.on('error', () => {
            if (attempts >= maxAttempts) {
                onFail(new Error(`API não respondeu após ${maxAttempts} tentativas.`));
            } else {
                setTimeout(check, interval);
            }
        });
        req.on('timeout', () => { req.destroy(); });
        req.end();
    };
    check();
}

function startBackend(callback) {
    const jarPath = getJarPath();

    if (!fs.existsSync(jarPath)) {
        callback(new Error(`JAR não encontrado: ${jarPath}`));
        return;
    }

    // Ensure data directory exists (Spring Boot uses it for H2 persistence)
    const dataDir = getDataDir();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Locate java binary
    const javaBin = process.platform === 'win32' ? 'java.exe' : 'java';

    const jvmArgs = [
        '-Xms64m',           // Low initial heap for fast startup
        '-Xmx256m',          // Max 256MB RAM
        '-XX:+UseG1GC',
        '-Djava.awt.headless=true',
        '-Dspring.datasource.url=jdbc:h2:file:' + path.join(dataDir, 'nexusdb') + ';DB_CLOSE_ON_EXIT=FALSE',
        '-Dspring.datasource.driverClassName=org.h2.Driver',
        '-Dspring.jpa.database-platform=org.hibernate.dialect.H2Dialect',
        '-Dserver.port=8080',
        '-jar',
        jarPath
    ];

    let called = false;
    const doneCallback = (err) => {
        if (!called) {
            called = true;
            callback(err);
        }
    };

    backendProcess = spawn(javaBin, jvmArgs, {
        env: { ...process.env, PATH: ENV_PATH },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true   // Windows: no console window
    });

    backendProcess.stdout.on('data', (data) => {
        // Forward to main terminal if window is open
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('terminal.incData', '\x1b[90m[server] ' + data.toString() + '\x1b[0m');
    });
    backendProcess.stderr.on('data', (data) => {
        // Spring Boot logs go to stderr — not necessarily errors
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('terminal.incData', '\x1b[90m[server] ' + data.toString() + '\x1b[0m');
    });
    backendProcess.on('error', (err) => {
        doneCallback(err);
    });

    // Give the JVM 2 seconds to start, then start polling
    setTimeout(() => doneCallback(null), 2000);
}

// ═════ LAUNCH SEQUENCE ═════
async function launch() {
    // 1. Show splash
    createSplashWindow();
    
    // 2. Prepare main window (load in background)
    createMainWindow();

    setupAutoUpdater();

    // Step 0 - Conectar ao Banco de Dados (PostgreSQL local)
    sendSplashProgress(0, 10, 'Conectando ao banco de dados...');
    await db.connect({ user: 'postgres', password: '5127805124' });

    sendSplashProgress(3, 100, 'Sistema pronto!');

    // Show main window and close splash immediately
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
    }

    // Inicia o backend silenciosamente em segundo plano (se existir)
    startBackend((err) => {
        if (err) {
            console.error('Falha ao iniciar backend local:', err.message);
        }
    });
}

// ═════ APP LIFECYCLE ═════
app.whenReady().then(launch);

app.on('window-all-closed', () => {
    // Kill backend when app closes
    if (backendProcess) {
        try { backendProcess.kill(); } catch (e) {}
        backendProcess = null;
    }
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) launch();
});

app.on('before-quit', () => {
    if (backendProcess) {
        try { backendProcess.kill('SIGTERM'); } catch (e) {}
    }
});
