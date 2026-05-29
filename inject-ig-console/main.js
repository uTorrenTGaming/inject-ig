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
        const bundledPython = path.join(process.resourcesPath, 'python', pyBinName);
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
        width: 1000,
        height: 700,
        show: false, // Oculto até o splash terminar
        backgroundColor: '#00000000',
        transparent: true,
        titleBarStyle: 'hiddenInset',
        alwaysOnTop: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
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
                cmd = `cd "${userDataPath}" && curl -L https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin.zip -o ollama.zip && unzip -o -j ollama.zip Ollama.app/Contents/Resources/ollama -d ollama_bin && chmod +x ollama_bin/ollama && rm ollama.zip`;
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
            return { success: false, error: 'Ollama API Error' };
        } catch (e) {
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
    ipcMain.on('window.maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            else mainWindow.maximize();
        }
    });
    
    // iPhone 3D Window Resizer
    let lastWindowBounds = { width: 1000, height: 700 };
    ipcMain.on('window.toggle-iphone-mode', (event, enable) => {
        if (!mainWindow) return;
        if (enable) {
            lastWindowBounds = mainWindow.getBounds();
            // iPhone 17 Pro Max dimensions + margins for shadow (e.g. 320x700 total window)
            mainWindow.setMinimumSize(320, 700);
            mainWindow.setSize(320, 700, true);
            mainWindow.setAlwaysOnTop(true, 'floating');
        } else {
            mainWindow.setAlwaysOnTop(false);
            mainWindow.setMinimumSize(450, 600);
            mainWindow.setBounds(lastWindowBounds, true);
        }
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
            terminalCwd = fs.existsSync(devEngineDir) ? devEngineDir : __dirname;
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
            
            if (toolId === 'nmap_portscan') {
                scriptPath = path.join(__dirname, 'tools', 'network', 'nmap_portscan.py');
                isPython = true;
            } else if (toolId === 'lfi_fuzzer' || toolId === 'sec_lfi') {
                scriptPath = path.join(__dirname, 'tools', 'exploits', 'lfi_fuzzer.py');
                isPython = true;
            } else if (toolId === 'data_b64') {
                scriptPath = path.join(__dirname, 'tools', 'utils', 'base64_codec.js');
                isPython = false;
            } else {
                scriptPath = path.join(__dirname, 'tools', 'universal_tool.py');
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
        const child = exec('npx --yes localtunnel --port 8080', { cwd: __dirname });
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
            let replyText = 'Não consegui entender.';
            let respondingModelName = 'Agente IG';
            if (model === 'groq-llama3') {
                if (!process.env.GROQ_API_KEY) return { text: '⚠️ GROQ_API_KEY não encontrada no .env.', modelName: 'Sistema' };
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: text }] })
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
                    body: JSON.stringify({ model: actualModel, messages: [{role: 'user', content: text}] })
                });
                const json = await res.json();
                replyText = json.choices?.[0]?.message?.content || `Erro na resposta do GitHub Models (${actualModel}).`;
                respondingModelName = actualModel + " (GitHub)";
            } else if (model.includes(':free')) {
                if (!process.env.OPENROUTER_API_KEY) return { text: '⚠️ OPENROUTER_API_KEY não encontrada no .env.', modelName: 'Sistema' };
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://github.com/uTorrenTGaming/inject-ig', 'X-Title': 'Inject-IG Agent' },
                    body: JSON.stringify({ model, messages: [{ role: 'user', content: text }] })
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
                        body: JSON.stringify({ message: text })
                    });
                    const json = await res.json();
                    replyText = json.reply || json.response || json.message || 'Sucesso.';
                    respondingModelName = 'Custom API';
                } catch (err) {
                    replyText = `⚠️ Erro na API Customizada (${customUrl}).`;
                    respondingModelName = 'Sistema';
                }
            }
            const p = getChatHistoryPath();
            let history = [];
            if (fs.existsSync(p)) { try { history = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {} }
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
    const jarPath = getJarPath();

    if (!fs.existsSync(jarPath)) {
        callback(new Error(`JAR não encontrado: ${jarPath}`));
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
        console.log('[JAVA] ' + data.toString());
        // Forward to main terminal if window is open
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('terminal.incData', '\x1b[90m[server] ' + data.toString() + '\x1b[0m');
    });
    backendProcess.stderr.on('data', (data) => {
        console.error('[JAVA ERROR] ' + data.toString());
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
    // 1. Abre a splash (única janela visível durante o carregamento)
    createSplashWindow();

    // 2. Carrega a janela principal em segundo plano (escondida)
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
        await new Promise((resolve, reject) => {
            // Increase timeout to 90 seconds (90 attempts of 1000ms) because Spring Boot
            // can take ~30s on first boot to create the H2 database schema.
            waitForApi(90, 1000, resolve, reject);
        });
        sendSplashProgress(4, 100, 'Sistema pronto!');
    } catch (e) {
        sendSplashProgress(4, 100, 'Aviso: Core demorando a responder...');
        log.error('Core timeout:', e);
    }

    await new Promise(r => setTimeout(r, 400)); // Pequena pausa visual

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
    }
}

// ═════ APP LIFECYCLE ═════
app.whenReady().then(() => {
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
});
