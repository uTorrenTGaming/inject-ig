const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const fs = require('fs');
const os = require('os');
const { exec, spawn, execSync } = require('child_process');
const http = require('http');
const https = require('https');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const db = require('./src/db');
const { machineIdSync } = require('node-machine-id');

// ═════ GLOBAL ERROR HANDLERS ═════
process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') return; // Ignora EPIPE do console.log
    log.error('[Uncaught Exception]', err);
});
process.on('unhandledRejection', (reason) => {
    log.error('[Unhandled Rejection]', reason);
});

// ═════ ACELERAÇÃO GRÁFICA EXTREMA ═════
// Força o MacOS e Windows a usarem a GPU Dedicada (Ex: AMD Radeon) em vez da Integrada (Intel)
app.commandLine.appendSwitch('force_high_performance_gpu');
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
        return path.join(process.resourcesPath, 'backend', 'core.dat');
    }
    // Dev mode: look one level up for the shared JAR
    const devJar = path.join(__dirname, 'backend', 'core.dat');
    if (fs.existsSync(devJar)) return devJar;
    return path.join(__dirname, '../inject-ig-core.dat');
}

function getDataDir() {
    return path.join(app.getPath('userData'), 'inject-ig-data');
}

// ═════ SYSTEM PATH (cross-platform: mac, linux, windows) ═════
const SEP = process.platform === 'win32' ? ';' : ':';

// Monta lista de caminhos por plataforma
const EXTRA_PATHS = [];

if (process.platform === 'darwin') {
    EXTRA_PATHS.push(
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/opt/openjdk/bin',
        '/opt/homebrew/opt/openjdk/bin',
        '/opt/homebrew/opt/openjdk@21/bin',
        '/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home/bin'
    );
} else if (process.platform === 'linux') {
    EXTRA_PATHS.push(
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
        '/usr/lib/jvm/java-21-openjdk-amd64/bin',
        '/usr/lib/jvm/java-21-openjdk/bin',
        '/usr/lib/jvm/java-21/bin',
        '/usr/lib/jvm/temurin-21/bin',
        '/usr/lib/jvm/java-17-openjdk-amd64/bin',
        '/usr/lib/jvm/java-11-openjdk-amd64/bin',
        '/snap/bin'
    );
} else if (process.platform === 'win32') {
    EXTRA_PATHS.push(
        'C:\\Windows\\System32',
        'C:\\Windows',
        'C:\\Program Files\\Java\\jdk-21\\bin',
        'C:\\Program Files\\Java\\jdk-17\\bin',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot\\bin',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.11.9-hotspot\\bin',
        'C:\\Program Files\\Microsoft\\jdk-21.0.0.35-hotspot\\bin',
        'C:\\Program Files\\Amazon Corretto\\jdk21\\bin',
        'C:\\Program Files (x86)\\Common Files\\Oracle\\Java\\javapath'
    );
    // Adiciona JAVA_HOME se definido
    if (process.env.JAVA_HOME) EXTRA_PATHS.push(path.join(process.env.JAVA_HOME, 'bin'));
}

// Adiciona JAVA_HOME genérico se definido (qualquer plataforma)
if (process.env.JAVA_HOME && process.platform !== 'win32') {
    EXTRA_PATHS.push(path.join(process.env.JAVA_HOME, 'bin'));
}

const ENV_PATH = [...EXTRA_PATHS, process.env.PATH || ''].join(SEP);

// ═════ JAVA BINARY FINDER ═════
function findJavaBinary() {
    const isWin = process.platform === 'win32';
    const javaBin = isWin ? 'java.exe' : 'java';

    const ensureExecutable = (binPath) => {
        if (!isWin && fs.existsSync(binPath)) {
            try { fs.chmodSync(binPath, 0o755); } catch(e) {}
        }
        return binPath;
    };

    // 🥇 PRIORIDADE 1 — JRE BUNDLED dentro do app (quando empacotado)
    // Localização: <app>/Contents/Resources/jre/bin/java  (Mac/Linux)
    //              <install>/resources/jre/bin/java.exe   (Windows)
    if (isPackaged) {
        let bundledJava = path.join(process.resourcesPath, 'jre', 'bin', javaBin);
        if (process.platform === 'darwin') {
            bundledJava = path.join(process.resourcesPath, 'jre', 'Contents', 'Home', 'bin', javaBin);
        }
        if (fs.existsSync(bundledJava)) {
            log.info(`[backend] Usando JRE bundled: ${bundledJava}`);
            return ensureExecutable(bundledJava);
        }
        log.warn(`[backend] JRE bundled não encontrado em: ${bundledJava}`);
    } else {
        // 🥇 PRIORIDADE 1.5 — JRE Local (Dev Mode)
        let devJava = '';
        if (process.platform === 'darwin') {
            devJava = path.join(__dirname, 'jre', 'mac', 'Contents', 'Home', 'bin', javaBin);
        } else if (process.platform === 'win32') {
            devJava = path.join(__dirname, 'jre', 'win', 'bin', javaBin);
        } else {
            devJava = path.join(__dirname, 'jre', 'linux', 'bin', javaBin);
        }
        if (fs.existsSync(devJava)) {
            log.info(`[backend] Usando JRE local (dev): ${devJava}`);
            return ensureExecutable(devJava);
        }
    }

    // 🥈 PRIORIDADE 2 — JAVA_HOME definido pelo sistema
    if (process.env.JAVA_HOME) {
        const fromHome = path.join(process.env.JAVA_HOME, 'bin', javaBin);
        if (fs.existsSync(fromHome)) {
            log.info(`[backend] Usando Java via JAVA_HOME: ${fromHome}`);
            return fromHome;
        }
    }

    // 🥉 PRIORIDADE 3 — Busca em caminhos comuns por plataforma
    for (const dir of EXTRA_PATHS) {
        const candidate = path.join(dir, javaBin);
        try {
            if (fs.existsSync(candidate)) {
                log.info(`[backend] Java encontrado em: ${candidate}`);
                return candidate;
            }
        } catch (e) {}
    }

    // 🔚 FALLBACK — Assume que java está no PATH do sistema
    log.warn(`[backend] Java não encontrado nos caminhos conhecidos. Tentando PATH do sistema.`);
    return javaBin;
}

// ═════ PYTHON BINARY FINDER ═════
function findPythonBinary() {
    const isWin = process.platform === 'win32';
    const pyBinName = isWin ? 'python.exe' : 'bin/python3';

    // 1. PRIORIDADE 1 - Python Bundled
    if (isPackaged) {
        let bundledPython = path.join(process.resourcesPath, 'python', 'python', pyBinName);
        if (!fs.existsSync(bundledPython)) {
            // Fallback just in case the structure was flattened
            bundledPython = path.join(process.resourcesPath, 'python', pyBinName);
        }
        if (fs.existsSync(bundledPython)) {
            log.info(`[backend] Usando Python bundled: ${bundledPython}`);
            return bundledPython;
        }
    } else {
        // Dev Mode Python
        let devPython = '';
        if (process.platform === 'darwin') {
            devPython = path.join(__dirname, 'python', 'mac', 'python', pyBinName);
        } else if (process.platform === 'win32') {
            devPython = path.join(__dirname, 'python', 'win', 'python', pyBinName);
        } else {
            devPython = path.join(__dirname, 'python', 'linux', 'python', pyBinName);
        }
        if (fs.existsSync(devPython)) {
            log.info(`[backend] Usando Python local (dev): ${devPython}`);
            return devPython;
        }
    }

    // No Windows, o executável é 'python' (sem o 3) por padrão
    if (process.platform === 'win32') {
        // Verifica se python3.exe existe primeiro
        const py3Candidates = [
            'C:\\Python312\\python.exe',
            'C:\\Python311\\python.exe',
            'C:\\Python310\\python.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python312\\python.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python311\\python.exe'),
        ];
        for (const p of py3Candidates) {
            if (fs.existsSync(p)) return p;
        }
        return 'python'; // Fallback ao PATH
    }
    // Mac e Linux: python3
    return 'python3';
}

// ═════ SPLASH WINDOW (REMOVIDO PARA TRANSIÇÃO PERFEITA) ═════
function sendSplashProgress(step, progress, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('splash.progress', { step, progress, message });
    }
}

// ═════ MAIN APP WINDOW ═════
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 850,
        height: 600,
        show: true, // Mostra imediatamente para exibir o splash embutido
        backgroundColor: '#1c1c1e',
        transparent: false,
        frame: true,
        hasShadow: true,
        alwaysOnTop: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
    
    // Loga erros do renderer no console principal (silencioso na UI)
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const prefix = level === 3 ? '[RENDERER ERROR]' : level === 2 ? '[RENDERER WARN]' : '[RENDERER LOG]';
        console.log(`${prefix} L${line}: ${message}`);
    });
    
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('[RENDERER CRASHED]', details);
    });
}

// ═════ RATE LIMITING (Auth) ═════
const loginAttempts = new Map();

// ═════ IPC HANDLERS (registrados uma única vez) ═════
function setupIpcHandlers() {
    // ── Auth & HWID ──
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
            const now = Date.now();
            const attempts = loginAttempts.get(hwid) || { count: 0, firstAttempt: now };
            if (now - attempts.firstAttempt > 60000) {
                attempts.count = 1;
                attempts.firstAttempt = now;
            } else {
                attempts.count++;
                if (attempts.count > 10) {
                    return { success: false, message: 'Muitas tentativas (Rate Limit). Tente novamente em 1 minuto.' };
                }
            }
            loginAttempts.set(hwid, attempts);

            if (!db.client) await db.connect();
            const userCheck = await db.findUserByHWID(hwid);
            if (userCheck && userCheck.is_banned) {
                return { success: false, banned: true, message: 'Seu computador foi banido.' };
            }
            
            const hasLicense = await db.hasValidLicense(hwid);
            
            // Auto-login check (username is null)
            if (!username) {
                if (userCheck) {
                    // Pull user visually, we will block them later if !hasLicense
                    return { success: true, user: userCheck, requireLicense: !hasLicense };
                }
                return { success: false, requireRegistration: true };
            }

            // User clicked "Acessar Sistema"
            if (!hasLicense) {
                return { success: false, requireLicense: true };
            }

            const os_type = process.platform;
            if (username) {
                const user = await db.registerOrUpdateUser(hwid, username, avatar_url, os_type);
                return { success: true, user };
            }
            
            if (userCheck) {
                return { success: true, user: userCheck };
            }
            
            return { success: false, requireRegistration: true };
        } catch (e) {
            log.error('Erro de autenticação:', e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('system.activateLicense', async (event, key, hwid) => {
        try { return await db.activateLicense(key, hwid); }
        catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('system.submitSupportTicket', async (event, hwid, message, isAdmin = false) => {
        try { return await db.submitSupportTicket(hwid, message, isAdmin); }
        catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('system.getSupportMessages', async (event, hwid) => {
        try { return await db.getSupportMessages(hwid); }
        catch (e) { return { success: false, messages: [] }; }
    });

    ipcMain.handle('system.getAllActiveChats', async (event) => {
        try { return await db.getAllActiveChats(); }
        catch (e) { return { success: false, chats: [] }; }
    });

    // Setup Realtime Listener
    db.connect().then(() => {
        db.subscribeToSupportTickets((newMessage) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('realtime-support-message', newMessage);
            }
        });
    });

    ipcMain.handle('system.getAppUpdates', async (event) => {
        try { return await db.getAppUpdates(); }
        catch (e) { return { success: false, updates: [] }; }
    });

    ipcMain.handle('auth.getLicenseInfo', async (event, hwid) => {
        try { return await db.getLicenseInfo(hwid); }
        catch (e) { return null; }
    });

    ipcMain.handle('auth.checkBanStatus', async (event, hwid) => {
        try { return await db.checkBanStatus(hwid); }
        catch (e) { console.error('Error checking ban status:', e); return false; }
    });

    ipcMain.handle('network.getTraffic', () => new Promise((resolve) => {
        const { exec } = require('child_process');
        exec('netstat -an', (err, stdout) => {
            if (err) return resolve([]);
            const lines = stdout.split('\n');
            const ips = new Set();
            lines.forEach(line => {
                if (line.includes('ESTABLISHED')) {
                    const matches = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
                    if (matches && matches.length >= 2) {
                        // O IP remoto geralmente é o último na linha antes de ESTABLISHED
                        const foreignIp = matches[matches.length - 1];
                        if (!foreignIp.startsWith('127.') && !foreignIp.startsWith('10.') && !foreignIp.startsWith('192.168.') && !foreignIp.startsWith('172.') && foreignIp !== '0.0.0.0') {
                            ips.add(foreignIp);
                        }
                    }
                }
            });
            resolve(Array.from(ips).slice(0, 50)); // Limit to 50 max so we don't blow up API limits
        });
    }));

    // --- AI Engine Auto-Installer ---
    let ollamaProcess = null;

    ipcMain.handle('ai.installEngine', async () => {
        return new Promise((resolve) => {
            const { exec, spawn } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            
            const userDataPath = app.getPath('userData');
            const binFolder = path.join(userDataPath, 'ollama_bin');
            const binPath = path.join(binFolder, 'ollama');

            const startOllama = () => {
                if (ollamaProcess) return resolve({ success: true, message: 'Já rodando' });
                ollamaProcess = spawn(binPath, ['serve'], { detached: true, stdio: 'ignore' });
                ollamaProcess.unref();
                // Dá um tempo pro servidor subir
                setTimeout(() => resolve({ success: true, message: 'Motor iniciado' }), 3000);
            };

            // Se o binário já existe, só liga ele
            if (fs.existsSync(binPath)) {
                return startOllama();
            }

            // Se não existe, cria a pasta e baixa
            if (!fs.existsSync(binFolder)) fs.mkdirSync(binFolder, { recursive: true });

            let cmd = '';
            if (process.platform === 'darwin') {
                cmd = `cd "${userDataPath}" && rm -rf ollama_bin Ollama.app && curl -L https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin.zip -o ollama.zip && unzip -q -o ollama.zip "Ollama.app/Contents/Resources/*" && mv Ollama.app/Contents/Resources ollama_bin && rm -rf Ollama.app ollama.zip && xattr -cr ollama_bin && chmod +x ollama_bin/ollama`;
            } else if (process.platform === 'linux') {
                cmd = `cd "${userDataPath}" && curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64 -o ollama_bin/ollama && chmod +x ollama_bin/ollama`;
            } else {
                return resolve({ success: false, error: 'SO não suportado para auto-instalação no momento.' });
            }

            exec(cmd, (err) => {
                if (err) return resolve({ success: false, error: err.message });
                startOllama();
            });
        });
    });

    ipcMain.handle('ai.pullModel', async () => {
        try {
            // Usa stream: false para bloquear até o download do modelo (phi3 = ~2.3GB) acabar.
            // Para não dar timeout no frontend, o ideal é que o frontend chame e espere pacientemente.
            const res = await fetch('http://127.0.0.1:11434/api/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'phi3', stream: false })
            });
            if (res.ok) return { success: true };
            return { success: false, error: 'Falha no download da IA.' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ai.checkEngine', async () => {
        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            if (res.ok) {
                const data = await res.json();
                return { online: true, models: data.models || [] };
            }
            return { online: false };
        } catch (e) {
            return { online: false };
        }
    });

    ipcMain.handle('ai.sendMessage', async (event, modelName, messages) => {
        try {
            console.log(`[OLLAMA DEBUG] Sending to ${modelName}:`, JSON.stringify(messages));
            const res = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelName,
                    messages: messages,
                    stream: false
                })
            });
            if (res.ok) {
                const data = await res.json();
                return { success: true, message: data.message };
            }
            const errText = await res.text();
            console.error('[OLLAMA ERROR]', errText);
            return { success: false, error: 'Ollama API Error: ' + errText };
        } catch (e) {
            console.error('[OLLAMA FETCH ERROR]', e.message);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('system.getGPUInfo', async () => {
        try { return await app.getGPUInfo('complete'); }
        catch (e) { console.error('GPU Info Error:', e); return null; }
    });

    // ── Window Controls ──
    ipcMain.on('window.close', () => { if (mainWindow) mainWindow.close(); });
    ipcMain.on('window.minimize', () => { if (mainWindow) mainWindow.minimize(); });
    ipcMain.on('window.set-fullscreen', (event, flag) => {
        if (mainWindow) {
            mainWindow.setFullScreen(flag);
        }
    });
    ipcMain.on('window.maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            else mainWindow.maximize();
        }
    });
    
    // iPhone 3D Window Resizer (Global now)
    let lastWindowBounds = { width: 460, height: 970 };
    ipcMain.on('window.toggle-iphone-mode', (event, enable) => {
        // Ignorado porque agora o iPhone é global
    });

    // ── Terminal ──
    ipcMain.on('terminal.keystroke', (event, command) => {
        if (!command || command.trim() === '') return;
        if (command === 'exit_app') { app.quit(); return; }
        if (command === 'min_app') { mainWindow && mainWindow.minimize(); return; }
        let terminalCwd;
        if (isPackaged) {
            terminalCwd = app.getPath('userData');
        } else {
            const devEngineDir = path.join(__dirname, '../inject-ig-engine');
            terminalCwd = fs.existsSync(devEngineDir) ? devEngineDir : app.getPath('userData');
        }
        const childProc = exec(command, { cwd: terminalCwd, env: { ...process.env, PATH: ENV_PATH }, windowsHide: true });
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

    // ── C2 Handlers ──
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
        } catch (e) { return { success: false, message: 'Erro: ' + e.message }; }
    });

    function getAdbPath() {
        const p = process.platform;
        const adbExe = p === 'win32' ? 'adb.exe' : 'adb';
        const isDev = !app.isPackaged;
        const adbFolder = isDev ? path.join(__dirname, 'adb', p === 'win32' ? 'win' : p === 'darwin' ? 'mac' : 'linux') 
                                : path.join(process.resourcesPath, 'adb');
        return path.join(adbFolder, adbExe);
    }

    ipcMain.handle('c2.getMobileDevices', async () => {
        return new Promise(async (resolve) => {
            let devices = [];
            const adb = getAdbPath();
            
            // 1. Android devices via bundled ADB
            try {
                if (fs.existsSync(adb)) {
                    const stdout = execSync(`"${adb}" devices`).toString();
                    stdout.split('\n').slice(1).map(l => l.trim()).filter(l => l).forEach(line => {
                        const [id, status] = line.split('\t');
                        if (id && status) devices.push({ id, status, platform: 'android', name: `Android (${id})` });
                    });
                }
            } catch(e) { console.error('ADB error', e); }

            // 2. iOS devices via appium-ios-device
            try {
                const { utilities } = require('appium-ios-device');
                const iosDevices = await utilities.getConnectedDevices();
                for (const id of iosDevices) {
                    devices.push({ id, status: 'online', platform: 'ios', name: `iPhone/iPad (${id.substring(0,8)})` });
                }
            } catch(e) { console.error('appium-ios-device error', e); }
            
            resolve({ success: true, devices });
        });
    });

    let activeSyslogProcess = null;
    let activeIosSyslog = null;

    ipcMain.handle('mobile.startSyslog', async (event, deviceId, platform) => {
        if (activeSyslogProcess) { activeSyslogProcess.kill(); activeSyslogProcess = null; }
        if (activeIosSyslog) { activeIosSyslog.close(); activeIosSyslog = null; }

        if (platform === 'android') {
            const adb = getAdbPath();
            execSync(`"${adb}" -s ${deviceId} logcat -c`).toString(); // Clear previous logs
            activeSyslogProcess = spawn(adb, ['-s', deviceId, 'logcat', '-v', 'time']);
            
            activeSyslogProcess.stdout.on('data', d => {
                if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mobile.syslogData', d.toString());
            });
            activeSyslogProcess.stderr.on('data', d => {
                if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mobile.syslogData', d.toString());
            });
            return { success: true };
        } else if (platform === 'ios') {
            try {
                const { services } = require('appium-ios-device');
                activeIosSyslog = await services.startSyslogService(deviceId);
                activeIosSyslog.start((logLine) => {
                    if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mobile.syslogData', logLine + '\n');
                });
                return { success: true };
            } catch (e) {
                return { success: false, message: e.message };
            }
        }
        return { success: false, message: 'Platform desconhecida' };
    });

    ipcMain.handle('mobile.stopSyslog', async () => {
        if (activeSyslogProcess) { activeSyslogProcess.kill(); activeSyslogProcess = null; }
        if (activeIosSyslog) { activeIosSyslog.close(); activeIosSyslog = null; }
        return { success: true };
    });

    ipcMain.handle('c2.saveReport', async (event, data) => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Salvar Relatório', defaultPath: 'inject-ig-report.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (filePath) { fs.writeFileSync(filePath, data); return { success: true, message: 'Salvo em: ' + filePath }; }
        return { success: false, message: 'Cancelado' };
    });

    // ═════ RUN TOOL IPC ═════
    ipcMain.handle('system.runTool', async (event, toolId, target) => {
        return new Promise((resolve) => {
            const sendLog = (msg) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('terminal.incData', msg.replace(/\n/g, '\r\n'));
                }
            };
            
            sendLog(`\\x1b[36m[SYSTEM]\\x1b[0m Iniciando motor para: ${toolId}...\\r\\n`);
            
            // Map toolId to actual scripts
            let scriptPath = '';
            let isPython = false;
            
            const baseToolsDir = isPackaged 
                ? path.join(process.resourcesPath, 'tools') 
                : path.join(__dirname, 'tools');

            if (toolId === 'nmap_portscan') {
                scriptPath = path.join(baseToolsDir, 'network', 'nmap_portscan.py');
                isPython = true;
            } else if (toolId === 'lfi_fuzzer' || toolId === 'sec_lfi') {
                scriptPath = path.join(baseToolsDir, 'exploits', 'lfi_fuzzer.py');
                isPython = true;
            } else if (toolId === 'data_b64') {
                scriptPath = path.join(baseToolsDir, 'utils', 'base64_codec.js');
                isPython = false;
            } else {
                scriptPath = path.join(baseToolsDir, 'universal_tool.py');
                isPython = true;
            }

            if (!fs.existsSync(scriptPath)) {
                sendLog(`\\x1b[31m[ERRO]\\x1b[0m Script não encontrado: ${scriptPath}\\r\\n`);
                return resolve({ success: false, message: 'Script not found' });
            }

            let cmd, args;
            if (isPython) {
                cmd = findPythonBinary();
                args = [scriptPath, toolId, target];
            } else {
                cmd = 'node'; 
                args = [scriptPath, toolId, target];
            }

            sendLog(`\\x1b[90m[EXEC]\\x1b[0m ${cmd} ${scriptPath} ${toolId} ${target}\\r\\n`);

            const child = spawn(cmd, args, { env: { ...process.env, PATH: ENV_PATH } });
            
            let fullLog = '';

            child.stdout.on('data', (data) => {
                const str = data.toString();
                fullLog += str;
                sendLog(str);
            });

            child.stderr.on('data', (data) => {
                const str = data.toString();
                fullLog += str;
                sendLog(`\\x1b[31m${str}\\x1b[0m`);
            });

            child.on('close', (code) => {
                sendLog(`\\n\\x1b[32m[SYSTEM]\\x1b[0m Processo finalizado (Exit: ${code}).\\r\\n`);
                if (!fullLog) fullLog = 'Processo finalizado sem saída (Exit: ' + code + ')';
                resolve({ success: code === 0, code, message: fullLog });
            });
            
            child.on('error', (err) => {
                sendLog(`\\x1b[31m[FALHA FATAL]\\x1b[0m ${err.message}\\r\\n`);
                resolve({ success: false, message: err.message, error: err.message });
            });
        });
    });

    ipcMain.handle('system.exportReportPDF', async (event, dataObj) => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Exportar PDF', defaultPath: 'IG_Report.pdf',
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (!filePath) return { success: false, message: 'Cancelado' };
        
        return new Promise((resolve) => {
            try {
                let templateContent = fs.readFileSync(path.join(__dirname, 'report_template.html'), 'utf8');
                
                // Inject data
                templateContent = templateContent.replace('{{TARGET_URL}}', dataObj.url);
                templateContent = templateContent.replace('{{DATE}}', dataObj.date);
                templateContent = templateContent.replace('{{MODULE_NAME}}', dataObj.moduleName);
                templateContent = templateContent.replace('{{STATUS}}', dataObj.status);
                templateContent = templateContent.replace('{{RISK_GRADE}}', dataObj.riskGrade);
                templateContent = templateContent.replace('{{RISK_CLASS}}', dataObj.riskClass);
                templateContent = templateContent.replace('{{RAW_LOG}}', dataObj.rawLog);

                const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
                const tempHtmlPath = path.join(os.tmpdir(), `ig_report_${Date.now()}.html`);
                fs.writeFileSync(tempHtmlPath, templateContent, 'utf8');
                
                printWin.loadFile(tempHtmlPath);
                printWin.webContents.on('did-finish-load', async () => {
                    try {
                        const pdfData = await printWin.webContents.printToPDF({
                            printBackground: true,
                            pageSize: 'A4',
                            margins: { marginType: 'default' }
                        });
                        fs.writeFileSync(filePath, pdfData);
                        resolve({ success: true, message: 'PDF Exportado: ' + filePath });
                    } catch (e) {
                        resolve({ success: false, message: 'Erro: ' + e.message });
                    } finally {
                        try { fs.unlinkSync(tempHtmlPath); } catch (e) {}
                        printWin.close();
                    }
                });
            } catch (err) {
                resolve({ success: false, message: 'Erro interno: ' + err.message });
            }
        });
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
        const child = exec('npx --yes localtunnel --port 8080', { cwd: app.getPath('userData') });
        child.stdout.on('data', d => {
            const t = d.toString();
            if (t.includes('your url is:')) resolve({ success: true, url: t.split('your url is:')[1].trim() });
        });
        child.on('error', e => resolve({ success: false, message: e.message }));
        setTimeout(() => resolve({ success: false, message: 'Timeout ao gerar túnel.' }), 10000);
    }));

    // ── Agente IG (IA) ──
    const getChatHistoryPath = () => path.join(app.getPath('userData'), 'ig_chat_history.json');

    ipcMain.handle('c2.getChatHistory', async () => {
        try {
            const p = getChatHistoryPath();
            if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
            return [];
        } catch (e) { return []; }
    });

    ipcMain.handle('c2.sendChatMessage', async (event, text, model) => {
        try {
            const p = getChatHistoryPath();
            let history = [];
            if (fs.existsSync(p)) { try { history = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {} }
            
            // Build LLM context array (max last 20 messages to prevent token limits)
            const llmMessages = [];
            const recentHistory = history.slice(-20);
            for (const msg of recentHistory) {
                // OpenAI/Groq API expects 'user' or 'assistant'
                const role = msg.role === 'user' ? 'user' : 'assistant';
                llmMessages.push({ role, content: msg.content });
            }
            // Append current message
            llmMessages.push({ role: 'user', content: text });

            let replyText = 'Não consegui entender.';
            let respondingModelName = 'Agente IG';
            
            if (model === 'groq-llama3') {
                if (!process.env.GROQ_API_KEY) return { text: '⚠️ GROQ_API_KEY não encontrada no .env.', modelName: 'Sistema' };
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: llmMessages })
                });
                const json = await res.json();
                replyText = json.choices?.[0]?.message?.content || 'Erro na resposta do Groq.';
                respondingModelName = 'Llama 3 (Groq)';
            } else if (model.startsWith('github-')) {
                // Rota para GitHub Models
                if (!process.env.GH_TOKEN) return { text: "⚠️ Erro: GH_TOKEN não encontrada no .env. Adicione um token do GitHub para usar este modelo.", modelName: "Sistema" };
                const actualModel = model.replace('github-', '');
                const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.GH_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: actualModel, messages: llmMessages })
                });
                const json = await res.json();
                replyText = json.choices?.[0]?.message?.content || `Erro na resposta do GitHub Models (${actualModel}).`;
                respondingModelName = actualModel + " (GitHub)";
            } else if (model.includes(':free')) {
                if (!process.env.OPENROUTER_API_KEY) return { text: '⚠️ OPENROUTER_API_KEY não encontrada no .env.', modelName: 'Sistema' };
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://github.com/uTorrenTGaming/inject-ig', 'X-Title': 'Inject-IG Agent' },
                    body: JSON.stringify({ model, messages: llmMessages })
                });
                const json = await res.json();
                replyText = json.choices?.[0]?.message?.content || `Erro na resposta do OpenRouter (${model}).`;
                respondingModelName = model.split('/')[1] || model;
            } else {
                const customUrl = process.env.CUSTOM_API_URL || 'http://localhost:5000/chat';
                try {
                    const res = await fetch(customUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CUSTOM_API_KEY || ''}` },
                        // For custom API, we just send the text, but could send history if supported
                        body: JSON.stringify({ message: text, history: llmMessages })
                    });
                    const json = await res.json();
                    replyText = json.reply || json.response || json.message || 'Sucesso.';
                    respondingModelName = 'Custom API';
                } catch (err) {
                    replyText = `⚠️ Erro na API Customizada (${customUrl}).`;
                    respondingModelName = 'Sistema';
                }
            }
            
            // Save to disk
            history.push({ role: 'user', content: text, timestamp: Date.now() });
            history.push({ role: 'ig', content: replyText, timestamp: Date.now(), model, modelName: respondingModelName });
            fs.writeFileSync(p, JSON.stringify(history, null, 2));
            
            return { text: replyText, modelName: respondingModelName };
        } catch (error) {
            return { text: `Erro interno: ${error.message}`, modelName: 'Sistema' };
        }
    });

    // ── USB Screen Capture ──
    let usbCaptureInterval = null;
    ipcMain.handle('system.startUSBCapture', async (event, platformStr, deviceId) => {
        if (usbCaptureInterval) { clearInterval(usbCaptureInterval); usbCaptureInterval = null; }
        
        return new Promise((resolve) => {
            const tmpFile = path.join(os.tmpdir(), 'inject_ig_screen.png');
            let resolved = false;

            if (platformStr === 'android') {
                const adb = getAdbPath();
                if (mainWindow && !mainWindow.isDestroyed())
                    mainWindow.webContents.send('terminal.incData', `\\x1b[32m[usb]\\x1b[0m Iniciando ADB Mirror (Android)...\\r\\n`);
                
                usbCaptureInterval = setInterval(() => {
                    try {
                        execSync(`"${adb}" -s ${deviceId} exec-out screencap -p > "${tmpFile}"`);
                        if (fs.existsSync(tmpFile)) {
                            if (!resolved) { resolved = true; resolve({ success: true }); }
                            const buf = fs.readFileSync(tmpFile);
                            if (mainWindow && !mainWindow.isDestroyed())
                                mainWindow.webContents.send('spectre.usbFrame', 'data:image/png;base64,' + buf.toString('base64'));
                        }
                    } catch (e) {
                        if (!resolved) { resolved = true; resolve({ success: false, message: 'Falha no ADB: ' + e.message }); }
                    }
                }, 500); // 2 FPS for stability over USB
            } else if (platformStr === 'ios') {
                const goIosBin = path.join(app.getPath('userData'), '.ig_tools', process.platform === 'win32' ? 'ios.exe' : 'ios');
                if (!fs.existsSync(goIosBin)) {
                    return resolve({ success: false, message: 'go-ios não encontrado. Reinicie o aplicativo.' });
                }
                if (mainWindow && !mainWindow.isDestroyed())
                    mainWindow.webContents.send('terminal.incData', `\\x1b[32m[usb]\\x1b[0m Iniciando go-ios Mirror (iOS)...\\r\\n`);
                
                usbCaptureInterval = setInterval(() => {
                    try {
                        // go-ios takes screenshot and saves to file
                        execSync(`"${goIosBin}" screenshot --udid=${deviceId} --output="${tmpFile}"`, { stdio: 'ignore' });
                        if (fs.existsSync(tmpFile)) {
                            if (!resolved) { resolved = true; resolve({ success: true }); }
                            const buf = fs.readFileSync(tmpFile);
                            if (mainWindow && !mainWindow.isDestroyed())
                                mainWindow.webContents.send('spectre.usbFrame', 'data:image/png;base64,' + buf.toString('base64'));
                        }
                    } catch (e) {
                        if (!resolved) { resolved = true; resolve({ success: false, message: 'O iOS bloqueia capturas nativas sem túnel ativo (Comum no iOS 17+). Use um dispositivo Android para espelhamento USB.' }); }
                    }
                }, 1000); // 1 FPS for iOS as DeveloperDiskImage screenshot is slower
            } else {
                resolve({ success: false, message: 'Selecione um dispositivo válido primeiro.' });
            }
        });
    });

    ipcMain.handle('system.stopUSBCapture', () => {
        if (usbCaptureInterval) { clearInterval(usbCaptureInterval); usbCaptureInterval = null; }
        return { success: true };
    });

    // ── Estúdio PDF & Docs ──
    ipcMain.handle('file.convert', async (event, filePath, targetFormat) => {
        return new Promise((resolve) => {
            if (!filePath) {
                return resolve({ success: false, message: 'Caminho de arquivo inválido.' });
            }
            const ext = path.extname(filePath);
            const base = path.basename(filePath, ext);
            const dir = path.dirname(filePath);
            
            let action = '';
            let extOut = '';
            
            if (targetFormat === 'docs-to-pdf') {
                action = 'docs2pdf';
                extOut = '.pdf';
            } else if (targetFormat === 'img-to-pdf') {
                action = 'img2pdf';
                extOut = '.pdf';
            } else if (targetFormat === 'pdf-to-docx') {
                action = 'pdf2docx';
                extOut = '.docx';
            } else if (targetFormat === 'pdf-to-txt') {
                action = 'pdf2txt';
                extOut = '.txt';
            } else {
                return resolve({ success: false, message: 'Ação desconhecida.' });
            }
            
            const outPath = path.join(dir, base + extOut);
            const scriptPath = isPackaged 
                ? path.join(process.resourcesPath, 'engine', 'pdf_studio.py') 
                : path.join(__dirname, 'engine', 'pdf_studio.py');
                
            const pyBin = findPythonBinary();
            const child = exec(`"${pyBin}" "${scriptPath}" ${action} "${filePath}" "${outPath}"`, { env: { ...process.env, PATH: ENV_PATH } });
            
            child.on('close', (code) => {
                if (code === 0 && fs.existsSync(outPath)) {
                    resolve({ success: true, outputPath: outPath });
                } else {
                    resolve({ success: false, message: `Falha na conversão via Python (Exit: ${code}).` });
                }
            });
        });
    });
    // ── PC Module ──
    ipcMain.handle('pc.getSystemStats', async () => {
        return {
            platform: os.platform(),
            arch: os.arch(),
            totalMem: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
            freeMem: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
            cpus: os.cpus().length,
            cpuModel: os.cpus()[0]?.model
        };
    });

    ipcMain.handle('pc.scanFolder', async (event) => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (result.canceled || result.filePaths.length === 0) return null;
        
        const targetPath = result.filePaths[0];
        let count = 0;
        let size = 0;
        let allFiles = [];
        
        async function scan(dir) {
            try {
                const files = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const f of files) {
                    const fullPath = path.join(dir, f.name);
                    if (f.isDirectory()) {
                        await scan(fullPath);
                    } else {
                        count++;
                        const st = await fs.promises.stat(fullPath);
                        size += st.size;
                        allFiles.push({ name: f.name, size: st.size });
                    }
                }
            } catch(e) {} // Ignorar pastas sem permissão
        }
        await scan(targetPath);
        
        allFiles.sort((a, b) => b.size - a.size);
        const topFiles = allFiles.slice(0, 30).map(f => ({
            name: f.name,
            sizeMb: (f.size / (1024 * 1024)).toFixed(2) + ' MB'
        }));
        
        return { success: true, files: count, sizeMb: size / (1024 * 1024), topFiles, path: targetPath };
    });

    ipcMain.handle('pc.organizeFolder', async (event) => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (result.canceled || result.filePaths.length === 0) return null;
        const targetPath = result.filePaths[0];
        
        const categories = {
            'Imagens': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'],
            'Documentos': ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.csv', '.md'],
            'Vídeos': ['.mp4', '.mkv', '.avi', '.mov', '.wmv'],
            'Áudio': ['.mp3', '.wav', '.ogg', '.flac'],
            'Arquivos': ['.zip', '.rar', '.7z', '.tar', '.gz'],
            'Programas': ['.exe', '.msi', '.dmg', '.pkg', '.deb']
        };
        
        let moved = 0;
        try {
            const files = await fs.promises.readdir(targetPath, { withFileTypes: true });
            for (const f of files) {
                if (!f.isDirectory()) {
                    const ext = path.extname(f.name).toLowerCase();
                    if (!ext) continue; // Pular arquivos sem extensão
                    
                    let destFolder = 'Outros';
                    for (const [folder, exts] of Object.entries(categories)) {
                        if (exts.includes(ext)) { destFolder = folder; break; }
                    }
                    
                    const destPath = path.join(targetPath, destFolder);
                    try { await fs.promises.mkdir(destPath, { recursive: true }); } catch(e){}
                    
                    const oldFile = path.join(targetPath, f.name);
                    const newFile = path.join(destPath, f.name);
                    
                    // Se o arquivo não existir lá, mover
                    if (!fs.existsSync(newFile)) {
                        await fs.promises.rename(oldFile, newFile);
                        moved++;
                    }
                }
            }
            return { success: true, moved };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('pc.clearTempFiles', async () => {
        const tempDir = os.tmpdir();
        let deletedFiles = 0;
        let freedSpace = 0;
        try {
            const files = await fs.promises.readdir(tempDir);
            for (const f of files) {
                const p = path.join(tempDir, f);
                try {
                    const st = await fs.promises.stat(p);
                    // Deletar arquivos temporários com mais de 24h
                    if (st.isFile() && (Date.now() - st.mtimeMs > 1000 * 60 * 60 * 24)) { 
                        await fs.promises.unlink(p);
                        deletedFiles++;
                        freedSpace += st.size;
                    }
                } catch(e){}
            }
            return { success: true, deletedFiles, freedMb: freedSpace / (1024*1024) };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // ── Local Exploits & Tools Engine ──
    ipcMain.handle('system.executeLocalScript', async (event, type, id, targetUrl, payloadData) => {
        return new Promise((resolve) => {
            if (!targetUrl) {
                return resolve({ success: false, message: 'URL Alvo não fornecida.' });
            }
            
            // type pode ser 'exploits' ou 'tools'
            const dirName = type === 'exploits' ? 'exploits' : 'tools';
            let scriptName = id + '.py';
            
            let scriptPath = isPackaged 
                ? path.join(process.resourcesPath, dirName, scriptName) 
                : path.join(__dirname, dirName, scriptName);
                
            if (!fs.existsSync(scriptPath)) {
                // FALLBACK genérico
                const fallbackName = type === 'exploits' ? 'generic_exploit.py' : 'generic_tool.py';
                scriptPath = isPackaged 
                    ? path.join(process.resourcesPath, dirName, fallbackName) 
                    : path.join(__dirname, dirName, fallbackName);
                    
                if (!fs.existsSync(scriptPath)) {
                    return resolve({ 
                        success: false, 
                        message: `Arquivo não encontrado.\nCaminho buscado: ${scriptPath}` 
                    });
                }
            }
            
            const pyBin = findPythonBinary();
            const child = exec(`"${pyBin}" "${scriptPath}" "${targetUrl}" "${payloadData || ''}"`, { env: { ...process.env, PATH: ENV_PATH } });
            
            let output = '';
            let isError = false;
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                output += data.toString();
                isError = true;
            });
            
            child.on('close', (code) => {
                resolve({ 
                    success: code === 0, 
                    message: output || (code === 0 ? 'Concluído sem saída de log.' : 'Falha na execução.')
                });
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // ── SITE EXTRACTOR ENGINE (Java Autônomo na porta 7890) ──────
    // ═══════════════════════════════════════════════════════════════
    const EXTRACTOR_PORT = 7890;
    let extractorProcess = null;

    /**
     * Compila e inicia o SiteExtractorEngine.java
     * Suporta: javac disponível (compila) ou Java 11+ (roda .java direto)
     */
    async function startExtractorEngine() {
        const engineDir = isPackaged
            ? path.join(process.resourcesPath, 'engine')
            : path.join(__dirname, 'engine');

        const javaSrc = path.join(engineDir, 'SiteExtractorEngine.java');
        const javaClass = path.join(engineDir, 'SiteExtractorEngine.class');
        const javaBin = findJavaBinary();

        // Se já está rodando, retorna
        try {
            const res = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/health`);
            if (res.ok) {
                log.info('[EXTRACTOR] Engine já online.');
                return { success: true, message: 'Engine já estava online.' };
            }
        } catch (e) { /* não está rodando, continua */ }

        if (!fs.existsSync(javaSrc)) {
            return { success: false, message: `SiteExtractorEngine.java não encontrado em: ${javaSrc}` };
        }

        // Tenta encontrar javac (pode não existir se for JRE)
        const findJavac = () => {
            const candidates = [
                javaBin.replace(/java$/, 'javac').replace(/java\.exe$/, 'javac.exe'),
                '/usr/bin/javac',
                '/usr/local/bin/javac',
            ];
            if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'javac'));
            // Procura em PATH
            const pathDirs = (process.env.PATH || '').split(':');
            for (const dir of pathDirs) {
                candidates.push(path.join(dir, 'javac'));
            }
            return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
        };

        const javacBin = findJavac();

        if (javacBin) {
            // Compila se necessário
            const needsCompile = !fs.existsSync(javaClass) ||
                fs.statSync(javaSrc).mtimeMs > fs.statSync(javaClass).mtimeMs;

            if (needsCompile) {
                log.info('[EXTRACTOR] Compilando SiteExtractorEngine.java...');
                try {
                    execSync(`"${javacBin}" "${javaSrc}"`, { cwd: engineDir, env: { ...process.env, PATH: ENV_PATH } });
                    log.info('[EXTRACTOR] Compilação OK.');
                } catch (e) {
                    log.warn('[EXTRACTOR] Compilação falhou, tentando source-file launcher...');
                    // Fallthrough para source-file launch
                }
            }

            if (fs.existsSync(javaClass)) {
                // Inicia processo Java compilado
                log.info('[EXTRACTOR] Iniciando SiteExtractorEngine (compiled)...');
                extractorProcess = spawn(javaBin, ['-cp', engineDir, 'SiteExtractorEngine'], {
                    cwd: engineDir, env: { ...process.env, PATH: ENV_PATH }, detached: false
                });
            } else {
                // Fallback: source file launch (Java 11+)
                log.info('[EXTRACTOR] Iniciando via source-file launch (Java 11+)...');
                extractorProcess = spawn(javaBin, [javaSrc], {
                    cwd: engineDir, env: { ...process.env, PATH: ENV_PATH }, detached: false
                });
            }
        } else {
            // Sem javac disponível: usa Java 11+ source file launcher diretamente
            log.info('[EXTRACTOR] javac não encontrado. Usando source-file launcher (Java 11+)...');
            extractorProcess = spawn(javaBin, [javaSrc], {
                cwd: engineDir, env: { ...process.env, PATH: ENV_PATH }, detached: false
            });
        }

        extractorProcess.stdout.on('data', (d) => log.info('[EXTRACTOR]', d.toString().trim()));
        extractorProcess.stderr.on('data', (d) => log.warn('[EXTRACTOR ERR]', d.toString().trim()));
        extractorProcess.on('close', (code) => {
            log.info(`[EXTRACTOR] Processo finalizado (Exit: ${code})`);
            extractorProcess = null;
        });

        // Aguarda até 15s para o engine subir
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 500));
            try {
                const res = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/health`);
                if (res.ok) {
                    log.info('[EXTRACTOR] Engine online!');
                    return { success: true, message: 'Engine iniciado com sucesso.' };
                }
            } catch (e) { /* aguarda */ }
        }
        return { success: false, message: 'Engine não subiu no tempo esperado (timeout 15s). Verifique se o Java 11+ está instalado.' };
    }


    ipcMain.handle('extractor.start', async () => {
        try { return await startExtractorEngine(); }
        catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('extractor.health', async () => {
        try {
            const res = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/health`);
            if (res.ok) return { online: true, data: await res.json() };
            return { online: false };
        } catch (e) { return { online: false }; }
    });

    ipcMain.handle('extractor.telemetry', async () => {
        try {
            const res = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/telemetry`);
            if (res.ok) return await res.json();
            return null;
        } catch (e) { return null; }
    });

    ipcMain.handle('extractor.scan', async (event, url) => {
        try {
            // Garante que o engine está rodando
            const health = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/health`).catch(() => null);
            if (!health || !health.ok) {
                const started = await startExtractorEngine();
                if (!started.success) return { success: false, message: started.message };
            }

            const res = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (res.ok) return { success: true, ...(await res.json()) };
            return { success: false, message: 'Engine retornou erro.' };
        } catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('extractor.result', async () => {
        try {
            const res = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/result`);
            if (res.ok) return { success: true, data: await res.json() };
            return { success: false };
        } catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('extractor.downloadItem', async (event, category, index) => {
        try {
            const res = await fetch(`http://127.0.0.1:${EXTRACTOR_PORT}/download?category=${encodeURIComponent(category)}&index=${index}`);
            if (res.ok) {
                const data = await res.json();
                // Salva o arquivo JSON via diálogo
                const { filePath } = await dialog.showSaveDialog(mainWindow, {
                    title: `Salvar ${category}[${index}].json`,
                    defaultPath: `${category}_${index}_${Date.now()}.json`,
                    filters: [{ name: 'JSON', extensions: ['json'] }]
                });
                if (filePath) {
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                    return { success: true, message: 'Salvo em: ' + filePath, filePath };
                }
                return { success: false, message: 'Cancelado' };
            }
            return { success: false, message: 'Item não encontrado' };
        } catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('extractor.downloadCategory', async (event, category, items) => {
        try {
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: `Exportar ${category}.json`,
                defaultPath: `${category}_completo_${Date.now()}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (filePath) {
                fs.writeFileSync(filePath, JSON.stringify({ category, items, exportedAt: new Date().toISOString() }, null, 2));
                return { success: true, message: 'Exportado em: ' + filePath };
            }
            return { success: false, message: 'Cancelado' };
        } catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('extractor.stop', async () => {
        if (extractorProcess) {
            try { extractorProcess.kill(); } catch (e) {}
            extractorProcess = null;
        }
        return { success: true };
    });

    // Mata o extractor quando o app fecha
    app.on('before-quit', () => {
        if (extractorProcess) { try { extractorProcess.kill(); } catch (e) {} }
    });

    // ── Payment API (Stripe Checkout) ──
    ipcMain.handle('payment.generateStripeCheckout', async (event, nick, plan, price) => {
        try {
            const token = process.env.STRIPE_SECRET_KEY;
            if (!token) {
                console.warn('[PAYMENT] STRIPE_SECRET_KEY não configurado no .env. Modo simulação.');
                return {
                    success: true,
                    session_id: 'mock_session_' + Date.now(),
                    url: 'https://checkout.stripe.com/mock'
                };
            }

            const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    'payment_method_types[0]': 'card',
                    'line_items[0][price_data][currency]': 'brl',
                    'line_items[0][price_data][product_data][name]': `Assinatura ${plan} Dias - ${nick}`,
                    'line_items[0][price_data][unit_amount]': Math.round(parseFloat(price) * 100),
                    'line_items[0][quantity]': 1,
                    'mode': 'payment',
                    'success_url': 'https://inject-ig.com/success', // URL genérica, não afeta o app
                    'cancel_url': 'https://inject-ig.com/cancel'
                })
            });

            const data = await res.json();
            if (res.ok && data.id) {
                return {
                    success: true,
                    session_id: data.id,
                    url: data.url
                };
            } else {
                console.error('[PAYMENT] Erro Stripe:', data);
                return { success: false, message: 'Falha na integração com Stripe' };
            }
        } catch (error) {
            console.error('[PAYMENT] Erro interno Stripe:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('payment.checkStripeStatus', async (event, sessionId, hwid, plan) => {
        try {
            const token = process.env.STRIPE_SECRET_KEY;
            if (!token) {
                // Modo simulação: aprova automaticamente para testes se mock
                return { approved: true, key: 'IG-MOCK-TEST' };
            }

            const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            // Status da Stripe
            if (res.ok && data.payment_status === 'paid') {
                // Auto generate and bind license
                const duration = parseInt(plan);
                const generatedKey = 'IG-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                
                if (!db.client) await db.connect();
                // Add to Supabase
                await db.client.from('licenses').insert([{
                    key: generatedKey,
                    duration_days: duration,
                    is_active: true,
                    hwid_vinculado: hwid,
                    activated_at: new Date().toISOString()
                }]);

                return { approved: true, key: generatedKey };
            }
            return { approved: false };
        } catch (error) {
            return { approved: false };
        }
    });

    // ── Payment API (Mercado Pago Static + Admin Approval via Licenses Table) ──
    ipcMain.handle('payment.registerPending', async (event, nick, plan, hwid) => {
        try {
            if (!db.client) await db.connect();
            
            // Delete any existing pending licenses for this hwid to avoid clutter
            await db.client.from('licenses').delete().like('key', `PENDING|%`).eq('hwid_vinculado', hwid);

            const pendingKey = `PENDING|${nick}|${plan}|${Date.now()}`;
            
            // Insert a "pending" license
            const { data, error } = await db.client.from('licenses').insert([{
                key: pendingKey,
                hwid_vinculado: hwid,
                duration_days: plan,
                is_active: false // Inactive until approved
            }]).select();

            if (error) {
                console.error('[PAYMENT] Erro ao registrar pagamento pendente:', error);
                return { success: false };
            }
            return { success: true, pending_id: data[0].id };
        } catch (error) {
            console.error('[PAYMENT] Erro interno registrar pendente:', error);
            return { success: false };
        }
    });

    ipcMain.handle('payment.checkPendingStatus', async (event, pendingId, hwid, plan) => {
        try {
            if (!db.client) await db.connect();
            // We just check if there is an active license for this HWID
            const { data: licData, error } = await db.client.from('licenses')
                .select('*')
                .eq('hwid_vinculado', hwid)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error || !licData || licData.length === 0) return { approved: false };

            // If we found an active license, it was approved!
            return { approved: true, key: licData[0].key };
        } catch (error) {
            return { approved: false };
        }
    });

    ipcMain.on('payment.openExternal', (event, url) => {
        shell.openExternal(url);
    });
}




// ═════ AUTO UPDATER ═════
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let downloadedUpdatePath = null;

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
        log.info('Update downloaded to: ' + info.downloadedFile);
        downloadedUpdatePath = info.downloadedFile;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update.ready', 'Atualização pronta para instalar.');
    });

    ipcMain.on('update.check', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
    
    ipcMain.on('update.install', () => {
        app.isQuiting = true;
        
        if (process.platform === 'darwin' && downloadedUpdatePath) {
            // Correção MacOS: O ShipIt (atualizador nativo da Apple) bloqueia silenciosamente a instalação
            // de atualizações se o app não tiver sido Assinado com um certificado pago de desenvolvedor.
            // Para contornar, fazemos a extração e substituição manual usando shell nativo.
            const { spawn } = require('child_process');
            const path = require('path');
            const appPath = app.getPath('exe').replace(/\.app\/Contents\/MacOS\/.*$/, '.app');
            const appDir = path.dirname(appPath);
            
            // Script que espera o app fechar (sleep 2), descompacta o zip baixado por cima, e reabre.
            const script = `
                sleep 2
                unzip -o -q "${downloadedUpdatePath}" -d "${appDir}"
                open "${appPath}"
            `;
            
            spawn('sh', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
            app.quit();
        } else {
            // Windows e Linux funcionam normalmente sem assinatura
            autoUpdater.quitAndInstall(false, true);
        }
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
    const datPath = getJarPath();

    if (!fs.existsSync(datPath)) {
        callback(new Error(`Motor CORE (criptografado) não encontrado: ${datPath}`));
        return;
    }

    // Decrypt on the fly to temp dir for execution
    const jarPath = path.join(app.getPath('userData'), 'core_runtime.jar');
    try {
        const buf = fs.readFileSync(datPath);
        const key = Buffer.from('IGOR_CORE_SECURE');
        for(let i=0; i<buf.length; i++) {
            buf[i] ^= key[i % key.length];
        }
        fs.writeFileSync(jarPath, buf);
    } catch(e) {
        callback(new Error(`Falha ao descriptografar o motor core: ${e.message}`));
        return;
    }

    // Ensure data directory exists (Spring Boot uses it for H2 persistence)
    const dataDir = getDataDir();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Locate java binary (cross-platform)
    const javaBin = findJavaBinary();

    const jvmArgs = [
        '-Xms64m',           // Low initial heap for fast startup
        '-Xmx256m',          // Max 256MB RAM
        '-XX:+UseG1GC',
        '-Djava.awt.headless=true',
        '-Dspring.datasource.url=jdbc:h2:file:' + path.join(dataDir, 'nexusdb').replace(/\\/g, '/') + ';DB_CLOSE_ON_EXIT=FALSE',
        '-Dspring.datasource.driverClassName=org.h2.Driver',
        '-Dspring.jpa.database-platform=org.hibernate.dialect.H2Dialect',
        '-Dserver.port=8080',
        '-jar',
        jarPath
    ];
    console.log('[DEBUG] dataDir:', dataDir);
    console.log('[DEBUG] jvmArgs:', jvmArgs);

    let called = false;
    const doneCallback = (err) => {
        if (!called) {
            called = true;
            callback(err);
        }
    };

    log.info(`[backend] Iniciando Java: ${javaBin}`);
    log.info(`[backend] JAR: ${jarPath}`);
    log.info(`[backend] Plataforma: ${process.platform}`);

    backendProcess = spawn(javaBin, jvmArgs, {
        env: { ...process.env, PATH: ENV_PATH },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true   // Windows: no console window
    });

    backendProcess.stdout.on('data', (data) => {
        log.info('[JAVA] ' + data.toString().trim());
        // Forward to main terminal if window is open
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('terminal.incData', '\x1b[90m[server] ' + data.toString() + '\x1b[0m');
    });
    backendProcess.stderr.on('data', (data) => {
        log.warn('[JAVA ERROR] ' + data.toString().trim());
        // Spring Boot logs go to stderr — not necessarily errors
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('terminal.incData', '\x1b[90m[server] ' + data.toString() + '\x1b[0m');
    });
    backendProcess.on('error', (err) => {
        log.error(`[backend] Falha ao iniciar Java: ${err.message}`);
        log.error(`[backend] Binário tentado: ${javaBin}`);
        log.error(`[backend] PATH usado: ${ENV_PATH}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal.incData',
                `\x1b[31m[ERRO CRÍTICO] Não foi possível iniciar o Java!\x1b[0m\n` +
                `\x1b[33m[dica] Instale o Java 21+ e certifique-se que está no PATH ou JAVA_HOME.\x1b[0m\n` +
                `\x1b[90m[binário] ${javaBin}\x1b[0m\n`
            );
        }
        doneCallback(err);
    });

    // Give the JVM 2 seconds to start, then start polling
    setTimeout(() => doneCallback(null), 2000);
}

// ═════ AUTO INSTALLER ═════
async function installDependencies() {
    const toolsDir = path.join(app.getPath('userData'), '.ig_tools');
    if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });

    const iosBinName = process.platform === 'win32' ? 'ios.exe' : 'ios';
    const goIosBin = path.join(toolsDir, iosBinName);
    if (!fs.existsSync(goIosBin)) {
        sendSplashProgress(3, 85, 'Baixando ferramentas iOS (go-ios)...');
        let zipUrl = '';
        if (process.platform === 'win32') zipUrl = 'https://github.com/danielpaulus/go-ios/releases/download/v1.0.213/go-ios-win.zip';
        else if (process.platform === 'darwin') zipUrl = 'https://github.com/danielpaulus/go-ios/releases/download/v1.0.213/go-ios-mac.zip';
        else zipUrl = 'https://github.com/danielpaulus/go-ios/releases/download/v1.0.213/go-ios-linux.zip';
        
        const zipPath = path.join(toolsDir, 'go-ios.zip');
        await new Promise((resolve, reject) => {
            const req = https.get(zipUrl, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    https.get(res.headers.location, (res2) => {
                        const file = fs.createWriteStream(zipPath);
                        res2.pipe(file);
                        file.on('finish', () => { file.close(); resolve(); });
                    }).on('error', reject);
                } else {
                    const file = fs.createWriteStream(zipPath);
                    res.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }
            }).on('error', reject);
        });
        
        sendSplashProgress(3, 90, 'Instalando ferramentas iOS...');
        try {
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(toolsDir, true);
            if (process.platform !== 'win32') {
                fs.chmodSync(goIosBin, 0o755);
            }
            fs.unlinkSync(zipPath);
        } catch(e) {
            console.error('Erro ao extrair go-ios:', e);
        }
    }
}

// ═════ LAUNCH SEQUENCE ═════
async function launch() {
    // Initialize Window
    createMainWindow();

    setupAutoUpdater();

    // Step 1 — Conectar ao Supabase (com timeout de 5s para não travar)
    sendSplashProgress(0, 20, 'Conectando ao banco de dados...');
    try {
        await Promise.race([
            db.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        sendSplashProgress(1, 40, 'Banco de dados conectado!');
    } catch (e) {
        console.warn('Supabase lento ou offline, continuando sem banco:', e.message);
        sendSplashProgress(1, 40, 'Modo offline — continuando...');
    }

    // Step 2 — Aguarda a janela principal terminar de carregar
    sendSplashProgress(2, 60, 'Carregando interface...');
    await new Promise((resolve) => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isLoading()) {
            mainWindow.webContents.once('did-finish-load', resolve);
        } else {
            resolve();
        }
    });

    // Step 3 — Inicia o backend em segundo plano e aguarda
    sendSplashProgress(3, 80, 'Iniciando Core (Pode demorar 5-10s)...');
    startBackend((err) => {
        if (err) {
            console.error('Falha ao iniciar backend local:', err.message);
        }
    });

    await installDependencies();

    try {
        // Core started in background. We do not block the UI for it to boot.
        // Spring Boot can take 10-15s, but the user should be able to login immediately.
        sendSplashProgress(4, 100, 'Sistema pronto!');
        
        // Spin off a background checker so we log when it's actually ready
        waitForApi(90, 1000, () => log.info('Core finally ready in background'), (e) => log.error('Core background timeout', e));
    } catch (e) {
        log.error('Erro na inicializacao background', e);
    }

    await new Promise(r => setTimeout(r, 100)); // Animação muito mais rápida

    // A UI em index.html lidará com a transição internamente
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
    }
}

// ═════ APP LIFECYCLE ═════
app.whenReady().then(() => {
    // ── Security Events (Regras 56 e 57) ──
    app.on('web-contents-created', (event, contents) => {
        contents.on('will-navigate', (event, navigationUrl) => {
            const parsedUrl = new URL(navigationUrl);
            if (parsedUrl.protocol !== 'file:') {
                event.preventDefault();
                console.warn('[SECURITY] Navegação bloqueada para:', navigationUrl);
            }
        });
        contents.setWindowOpenHandler(({ url }) => {
            console.warn('[SECURITY] Abertura de janela bloqueada para:', url);
            return { action: 'deny' };
        });
        contents.on('before-input-event', (event, input) => {
            if (input.control || input.meta) {
                if (['i', 'r'].includes(input.key.toLowerCase())) event.preventDefault();
            }
            if (input.key === 'F12') event.preventDefault();
        });
    });

    setupIpcHandlers(); // Registra handlers UMA VEZ antes de tudo
    launch();

    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('system.togglePanic');
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

app.on('window-all-closed', () => {
    // Kill backend when app closes
    if (backendProcess) {
        try { backendProcess.kill(); } catch (e) {}
        backendProcess = null;
    }
    if (process.platform !== 'darwin' || app.isQuiting) app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) launch();
});

app.on('before-quit', () => {
    if (backendProcess) {
        try { backendProcess.kill('SIGTERM'); } catch (e) {}
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    try {
        const runtimeJar = path.join(app.getPath('userData'), 'core_runtime.jar');
        if (fs.existsSync(runtimeJar)) fs.unlinkSync(runtimeJar);
    } catch(e) {}
});
