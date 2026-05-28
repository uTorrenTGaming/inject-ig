#!/usr/bin/env node
/**
 * download-jre.js
 * Baixa o Java 21 JRE (Eclipse Temurin) para Mac, Windows e Linux
 * e extrai nos diretórios jre/mac, jre/win, jre/linux
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JRE_DIR = path.join(__dirname, '..', 'jre');

// URLs da API Adoptium para JRE 21 LTS
const PLATFORMS = [
    {
        name: 'mac',
        url: 'https://api.adoptium.net/v3/binary/latest/21/ga/mac/x64/jre/hotspot/normal/eclipse',
        ext: 'tar.gz',
        outDir: path.join(JRE_DIR, 'mac'),
    },
    {
        name: 'win',
        url: 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse',
        ext: 'zip',
        outDir: path.join(JRE_DIR, 'win'),
    },
    {
        name: 'linux',
        url: 'https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse',
        ext: 'tar.gz',
        outDir: path.join(JRE_DIR, 'linux'),
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
            // Segue redirecionamentos
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
    const tmpDir = outDir + '__tmp';
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`tar -xzf "${tarFile}" -C "${tmpDir}"`, { stdio: 'inherit' });

    // O Temurin extrai numa subpasta tipo jdk-21.0.x+y-jre/ — move o conteúdo pra fora
    const entries = fs.readdirSync(tmpDir);
    if (entries.length === 1) {
        const extracted = path.join(tmpDir, entries[0]);
        // Move arquivos da subpasta para outDir
        const inner = fs.readdirSync(extracted);
        inner.forEach(f => {
            fs.renameSync(path.join(extracted, f), path.join(outDir, f));
        });
    } else {
        entries.forEach(f => {
            fs.renameSync(path.join(tmpDir, f), path.join(outDir, f));
        });
    }
    // Remove diretório temporário
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

function extractZip(zipFile, outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const tmpDir = outDir + '__tmp';
    fs.mkdirSync(tmpDir, { recursive: true });
    
    if (process.platform === 'win32') {
        execSync(`powershell -command "Expand-Archive -Force -Path '${zipFile}' -DestinationPath '${tmpDir}'"`, { stdio: 'inherit' });
    } else {
        execSync(`unzip -q "${zipFile}" -d "${tmpDir}"`, { stdio: 'inherit' });
    }

    const entries = fs.readdirSync(tmpDir);
    if (entries.length === 1) {
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
    console.log('║  inject-ig — Bundled JRE Downloader     ║');
    console.log('║  Java 21 LTS (Eclipse Temurin)          ║');
    console.log('╚══════════════════════════════════════════╝\n');

    fs.mkdirSync(JRE_DIR, { recursive: true });

    for (const plat of PLATFORMS) {
        // Pula se já existe e tem a pasta bin/
        const javaBin = path.join(plat.outDir, 'bin', plat.name === 'win' ? 'java.exe' : 'java');
        if (fs.existsSync(javaBin)) {
            console.log(`✅ JRE ${plat.name} já existe — pulando download.`);
            continue;
        }

        console.log(`\n📥 Baixando JRE para ${plat.name.toUpperCase()}...`);
        console.log(`   URL: ${plat.url}`);

        const tmpFile = path.join(JRE_DIR, `jre-${plat.name}.${plat.ext}`);

        try {
            await download(plat.url, tmpFile);

            console.log(`   Extraindo para ${plat.outDir}...`);
            if (fs.existsSync(plat.outDir)) fs.rmSync(plat.outDir, { recursive: true, force: true });

            if (plat.ext === 'tar.gz') {
                extractTarGz(tmpFile, plat.outDir);
            } else {
                extractZip(tmpFile, plat.outDir);
            }

            fs.unlinkSync(tmpFile);
            console.log(`✅ JRE ${plat.name.toUpperCase()} pronto em: ${plat.outDir}`);

        } catch (err) {
            console.error(`❌ Falha no JRE ${plat.name}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log('\n🎉 Todos os JREs prontos! Execute: npm run build:all\n');
}

main();
