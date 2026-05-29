#!/usr/bin/env node
/**
 * download-python.js
 * Baixa o Python Standalone (indygreg/python-build-standalone) para Mac, Windows e Linux
 * e extrai nos diretórios python/mac, python/win, python/linux
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PYTHON_DIR = path.join(__dirname, '..', 'python');

const PLATFORMS = [
    {
        name: 'mac',
        url: 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-x86_64-apple-darwin-install_only.tar.gz',
        outDir: path.join(PYTHON_DIR, 'mac'),
    },
    {
        name: 'win',
        url: 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz',
        outDir: path.join(PYTHON_DIR, 'win'),
    },
    {
        name: 'linux',
        url: 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-x86_64-unknown-linux-gnu-install_only.tar.gz',
        outDir: path.join(PYTHON_DIR, 'linux'),
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

function extractTarGz(tarFile, outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    execSync(`tar -xzf "${tarFile}" -C "${outDir}"`, { stdio: 'inherit' });
}

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  inject-ig — Bundled Python Downloader  ║');
    console.log('║  Python 3.10 (Standalone)               ║');
    console.log('╚══════════════════════════════════════════╝\n');

    fs.mkdirSync(PYTHON_DIR, { recursive: true });

    for (const plat of PLATFORMS) {
        const pyBin = path.join(plat.outDir, 'python', plat.name === 'win' ? 'python.exe' : 'bin/python3');
        if (fs.existsSync(pyBin)) {
            console.log(`✅ Python ${plat.name} já existe — pulando download.`);
            continue;
        }

        console.log(`\n📥 Baixando Python para ${plat.name.toUpperCase()}...`);
        const tmpFile = path.join(PYTHON_DIR, `python-${plat.name}.tar.gz`);

        try {
            await download(plat.url, tmpFile);
            console.log(`   Extraindo para ${plat.outDir}...`);
            if (fs.existsSync(plat.outDir)) fs.rmSync(plat.outDir, { recursive: true, force: true });
            extractTarGz(tmpFile, plat.outDir);
            fs.unlinkSync(tmpFile);
            console.log(`✅ Python ${plat.name.toUpperCase()} pronto em: ${plat.outDir}`);
        } catch (err) {
            console.error(`❌ Falha no Python ${plat.name}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log('\n🎉 Todos os motores Python prontos!\n');
}

main();
