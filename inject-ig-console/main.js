const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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

    // 🥇 PRIORIDADE 1 — JRE BUNDLED dentro do app (quando empacotado)
    // Localização: <app>/Contents/Resources/jre/bin/java  (Mac/Linux)
    //              <install>/resources/jre/bin/java.exe   (Windows)
    if (isPackaged) {
        const bundledJava = path.join(process.resourcesPath, 'jre', 'bin', javaBin);
        if (fs.existsSync(bundledJava)) {
            log.info(`[backend] Usando JRE bundled: ${bundledJava}`);
            return bundledJava;
        }
        log.warn(`[backend] JRE bundled não encontrado em: ${bundledJava}`);
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
        width: 450,
        height: 600,
        show: false, // Oculto até o splash terminar
        backgroundColor: '#07080d',
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
            return { success: false, needsRegistration: true };
        } catch (e) {
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
            } else { finish(); }
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
    let usbCaptureProcess = null;
    ipcMain.handle('system.startUSBCapture', () => new Promise((resolve) => {
        if (usbCaptureProcess) { usbCaptureProcess.kill(); usbCaptureProcess = null; }
        const scriptPath = isPackaged
            ? path.join(process.resourcesPath, 'engine', 'usb_capture.py')
            : path.join(__dirname, 'engine', 'usb_capture.py');
        const tmpFile = path.join(os.tmpdir(), 'inject_ig_screen.png');
        const pythonBin = findPythonBinary();
        usbCaptureProcess = spawn(pythonBin, [scriptPath], { env: { ...process.env, PATH: ENV_PATH }, windowsHide: true });
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
        app.isQuiting = true;
        autoUpdater.quitAndInstall(false, true);
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
        sendSplashProgress(1, 50, 'Banco de dados conectado!');
    } catch (e) {
        console.warn('Supabase lento ou offline, continuando sem banco:', e.message);
        sendSplashProgress(1, 50, 'Modo offline — continuando...');
    }

    // Step 2 — Aguarda a janela principal terminar de carregar
    sendSplashProgress(2, 80, 'Carregando interface...');
    await new Promise((resolve) => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isLoading()) {
            mainWindow.webContents.once('did-finish-load', resolve);
        } else {
            resolve();
        }
    });

    // Step 3 — Tudo pronto! Troca splash → janela principal
    sendSplashProgress(3, 100, 'Sistema pronto!');
    await new Promise(r => setTimeout(r, 400)); // Pequena pausa visual

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
app.whenReady().then(() => {
    setupIpcHandlers(); // Registra handlers UMA VEZ antes de tudo
    launch();
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
