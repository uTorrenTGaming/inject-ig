#!/usr/bin/env node
/**
 * download-adb.js
 * Baixa as ferramentas do Android SDK (platform-tools) com o ADB
 * para Mac, Windows e Linux.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ADB_DIR = path.join(__dirname, '..', 'adb');

const PLATFORMS = [
    {
        name: 'mac',
        url: 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
        outDir: path.join(ADB_DIR, 'mac'),
    },
    {
        name: 'win',
        url: 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
        outDir: path.join(ADB_DIR, 'win'),
    },
    {
        name: 'linux',
        url: 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip',
        outDir: path.join(ADB_DIR, 'linux'),
    },
];

function download(url, destFile, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 10) return reject(new Error('Too many redirects'));
        
        const file = fs.createWriteStream(destFile, { flags: 'w' });
        let totalBytes = 0;
        let downloadedBytes = 0;
        let lastPrint = 0;

        https.get(url, { headers: { 'User-Agent': 'inject-ig-build/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(destFile);
                return resolve(download(res.headers.location, destFile, redirectCount + 1));
            }

            if (res.statusCode !== 200) {
                file.close();
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }

            totalBytes = parseInt(res.headers['content-length'] || '0', 10);

            res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                const now = Date.now();
                if (now - lastPrint > 1000) {
                    const pct = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : '?';
                    const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
                    process.stdout.write(`\r   ${mb} MB (${pct}%)   `);
                    lastPrint = now;
                }
            });

            res.pipe(file);
            file.on('finish', () => {
                file.close();
                process.stdout.write('\r   Download completo!          \n');
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            try { fs.unlinkSync(destFile); } catch(e) {}
            reject(err);
        });
    });
}

function extractZip(zipFile, outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const tmpDir = outDir + '__tmp';
    fs.mkdirSync(tmpDir, { recursive: true });
    
    try {
        if (process.platform === 'win32') {
            execSync(`powershell -command "Expand-Archive -Force -Path '${zipFile}' -DestinationPath '${tmpDir}'"`, { stdio: 'inherit' });
        } else {
            execSync(`unzip -q "${zipFile}" -d "${tmpDir}"`, { stdio: 'inherit' });
        }
    } catch (e) {
        // Fallback para adm-zip se tiver erro de unzip nativo (especialmente em ambientes sem unzip)
        console.log("Fallback extraction via adm-zip");
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(zipFile);
        zip.extractAllTo(tmpDir, true);
    }

    const entries = fs.readdirSync(tmpDir);
    if (entries.length === 1 && entries[0] === 'platform-tools') {
        const extracted = path.join(tmpDir, entries[0]);
        const inner = fs.readdirSync(extracted);
        inner.forEach(f => {
            fs.renameSync(path.join(extracted, f), path.join(outDir, f));
        });
    } else {
        entries.forEach(f => {
            fs.renameSync(path.join(tmpDir, f), path.join(outDir, f));
        });
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  inject-ig — Bundled ADB Downloader     ║');
    console.log('║  Google Android SDK platform-tools       ║');
    console.log('╚══════════════════════════════════════════╝\n');

    fs.mkdirSync(ADB_DIR, { recursive: true });

    for (const plat of PLATFORMS) {
        const adbBin = path.join(plat.outDir, plat.name === 'win' ? 'adb.exe' : 'adb');
        if (fs.existsSync(adbBin)) {
            console.log(`✅ ADB ${plat.name} já existe — pulando download.`);
            continue;
        }

        console.log(`\n📥 Baixando ADB para ${plat.name.toUpperCase()}...`);
        console.log(`   URL: ${plat.url}`);

        const tmpFile = path.join(ADB_DIR, `adb-${plat.name}.zip`);

        try {
            await download(plat.url, tmpFile);

            console.log(`   Extraindo para ${plat.outDir}...`);
            if (fs.existsSync(plat.outDir)) fs.rmSync(plat.outDir, { recursive: true, force: true });

            extractZip(tmpFile, plat.outDir);

            // Permissões executáveis para Unix
            if (plat.name !== 'win') {
                try { execSync(`chmod +x "${path.join(plat.outDir, 'adb')}"`); } catch(e){}
            }

            fs.unlinkSync(tmpFile);
            console.log(`✅ ADB ${plat.name.toUpperCase()} pronto em: ${plat.outDir}`);

        } catch (err) {
            console.error(`❌ Falha no ADB ${plat.name}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log('\n🎉 Todos os binários ADB prontos!\n');
}

main();
