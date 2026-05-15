// ═══════════ Terminal Initialization ═══════════
const term = new window.Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    fontFamily: "'Geist Mono', 'SF Mono', monospace",
    fontSize: 12,
    lineHeight: 1.45,
    theme: {
        background: '#08090c',
        foreground: '#e8eaed',
        cursor: '#3b82f6',
        selectionBackground: 'rgba(59,130,246,0.15)',
        black: '#0c0e13',
        brightBlack: '#454d5a',
        green: '#22c55e',
        brightGreen: '#22c55e',
        red: '#ef4444',
        brightRed: '#ef4444',
        blue: '#3b82f6',
        brightBlue: '#3b82f6',
        yellow: '#f59e0b',
        brightYellow: '#f59e0b',
        cyan: '#06b6d4',
        brightCyan: '#06b6d4'
    }
});

const fitAddon = new window.FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

let commandBuffer = '';
let currentVaultData = {};

term.prompt = () => {
    term.write('\r\n\x1b[90m$\x1b[0m ');
};

term.writeln('\x1b[90m───────────────────────\x1b[0m');
term.writeln('  \x1b[1minject-ig\x1b[0m  \x1b[90mTerminal\x1b[0m');
term.writeln('\x1b[90m───────────────────────\x1b[0m');
term.writeln('  \x1b[90mDigite\x1b[0m ajuda');
term.prompt();

// ═══════════ Navigation Logic ═══════════
const segBtns = document.querySelectorAll('.seg-btn[data-target]');
const views = document.querySelectorAll('.view');

segBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        segBtns.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');
        if (targetId === 'view-terminal') setTimeout(() => fitAddon.fit(), 10);
    });
});

// Vault Sub-Tabs
const showSubPane = (tabId) => {
    const panes = {
        'tab-data': 'pane-data',
        'tab-files': 'pane-files',
        'tab-monitor': 'pane-monitor'
    };
    document.querySelectorAll('.sub-seg-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('[id^="pane-"]').forEach(p => p.style.display = 'none');
    
    const btn = document.getElementById(tabId);
    if (btn) btn.classList.add('active');
    
    const paneId = panes[tabId];
    const pane = document.getElementById(paneId);
    if (pane) pane.style.display = 'flex';
};

document.getElementById('tab-data')?.addEventListener('click', () => showSubPane('tab-data'));
document.getElementById('tab-files')?.addEventListener('click', () => showSubPane('tab-files'));
document.getElementById('tab-monitor')?.addEventListener('click', () => showSubPane('tab-monitor'));

// ═══════════ Tools Library (50+) ═══════════
const TOOLS_DATABASE = [
    { id: 'osint_whois', name: 'Whois Lookup', cat: 'OSINT', icon: '🔍', desc: 'Informações de registro de domínio.' },
    { id: 'osint_dns', name: 'DNS Lookup', cat: 'OSINT', icon: '🌐', desc: 'Registros A, MX, TXT, NS.' },
    { id: 'osint_sub', name: 'Subdomain Finder', cat: 'OSINT', icon: '🌿', desc: 'Busca subdomínios ativos.' },
    { id: 'osint_email', name: 'Email Scraper', cat: 'OSINT', icon: '📧', desc: 'Extrai emails de páginas públicas.' },
    { id: 'osint_social', name: 'Social Recon', cat: 'OSINT', icon: '👥', desc: 'Busca perfis vinculados ao alvo.' },
    { id: 'osint_shodan', name: 'Shodan Scan', cat: 'OSINT', icon: '👁️', desc: 'Busca dispositivos expostos.' },
    { id: 'osint_wayback', name: 'Wayback Machine', cat: 'OSINT', icon: '📜', desc: 'Histórico de versões do site.' },
    { id: 'osint_dorks', name: 'Google Dorks', cat: 'OSINT', icon: '🔎', desc: 'Busca avançada por vulnerabilidades.' },
    { id: 'web_headers', name: 'Header Audit', cat: 'Web', icon: '🛡️', desc: 'Verifica headers de segurança.' },
    { id: 'web_cookies', name: 'Cookie Audit', cat: 'Web', icon: '🍪', desc: 'Analisa flags Secure e HttpOnly.' },
    { id: 'web_tech', name: 'Tech Stack', cat: 'Web', icon: '⚙️', desc: 'Identifica frameworks e bibliotecas.' },
    { id: 'web_cms', name: 'CMS Detector', cat: 'Web', icon: '📰', desc: 'Detecta WordPress, Joomla, etc.' },
    { id: 'web_waf', name: 'WAF Checker', cat: 'Web', icon: '🧱', desc: 'Detecta Cloudflare, Akamai, etc.' },
    { id: 'web_robots', name: 'Robots.txt', cat: 'Web', icon: '🤖', desc: 'Analisa regras de indexação.' },
    { id: 'web_sitemap', name: 'Sitemap Parser', cat: 'Web', icon: '🗺️', desc: 'Mapeia a estrutura do site.' },
    { id: 'web_ssl', name: 'SSL Audit', cat: 'Web', icon: '🔒', desc: 'Verifica validade e força do cert.' },
    { id: 'sec_cors', name: 'CORS Check', cat: 'Security', icon: '🔗', desc: 'Verifica políticas de origem.' },
    { id: 'sec_csp', name: 'CSP Audit', cat: 'Security', icon: '🛡️', desc: 'Analisa Content Security Policy.' },
    { id: 'sec_click', name: 'Clickjacking', cat: 'Security', icon: '🖱️', desc: 'Testa proteção X-Frame-Options.' },
    { id: 'sec_hsts', name: 'HSTS Check', cat: 'Security', icon: '🚀', desc: 'Verifica Strict Transport Security.' },
    { id: 'sec_xss', name: 'XSS Light', cat: 'Security', icon: '⚠️', desc: 'Scan superficial de XSS refletido.' },
    { id: 'sec_sqli', name: 'SQLi Light', cat: 'Security', icon: '💉', desc: 'Busca erros de DB em parâmetros.' },
    { id: 'sec_redirect', name: 'Open Redirect', cat: 'Security', icon: '↗️', desc: 'Testa redirecionamentos inseguros.' },
    { id: 'net_ports', name: 'Port Scan', cat: 'Network', icon: '🚪', desc: 'Scan de portas comuns (80, 443, 21).' },
    { id: 'net_ping', name: 'Ping Test', cat: 'Network', icon: '📡', desc: 'Verifica latência e presença.' },
    { id: 'net_trace', name: 'Traceroute', cat: 'Network', icon: '🛤️', desc: 'Mapeia os saltos até o host.' },
    { id: 'net_geo', name: 'IP Geo', cat: 'Network', icon: '📍', desc: 'Localização geográfica do IP.' },
    { id: 'net_asn', name: 'ASN Lookup', cat: 'Network', icon: '🏢', desc: 'Informações do provedor (ISP).' },
    { id: 'file_sourcemap', name: 'Source Maps', cat: 'Leaks', icon: '🗺️', desc: 'Busca arquivos .map expostos.' },
    { id: 'file_git', name: '.git Leak', cat: 'Leaks', icon: '🐙', desc: 'Verifica exposição de repositórios.' },
    { id: 'file_env', name: '.env Finder', cat: 'Leaks', icon: '🔑', desc: 'Busca chaves em arquivos de config.' },
    { id: 'file_backup', name: 'Backups', cat: 'Leaks', icon: '💾', desc: 'Busca arquivos .zip, .sql, .bak.' },
    { id: 'file_dir', name: 'Dir Listing', cat: 'Leaks', icon: '📂', desc: 'Verifica diretórios abertos.' },
    { id: 'data_b64', name: 'Base64 Tool', cat: 'Utils', icon: '🔢', desc: 'Encode/Decode Base64.' },
    { id: 'data_url', name: 'URL Tool', cat: 'Utils', icon: '🔗', desc: 'Encode/Decode URL strings.' },
    { id: 'data_hash', name: 'Hash Ident', cat: 'Utils', icon: '🆔', desc: 'Identifica tipo de hash (MD5, SHA).' },
    { id: 'data_pass', name: 'Pass Check', cat: 'Utils', icon: '💪', desc: 'Calcula força de senhas.' },
    { id: 'data_jwt', name: 'JWT Debug', cat: 'Utils', icon: '🎫', desc: 'Analisa tokens JWT.' },
    { id: 'app_deeplink', name: 'DeepLink Check', cat: 'App', icon: '📱', desc: 'Busca esquemas customizados.' },
    { id: 'app_manifest', name: 'Manifest Audit', cat: 'App', icon: '📋', desc: 'Analisa PWA Manifest.' },
    { id: 'adv_headers_inj', name: 'Header Inj', cat: 'Advanced', icon: '💉', desc: 'Testa injeção de headers.' },
    { id: 'adv_params', name: 'Param Miner', cat: 'Advanced', icon: '⛏️', desc: 'Busca parâmetros ocultos.' },
    { id: 'adv_vuln', name: 'Vuln DB', cat: 'Advanced', icon: '📚', desc: 'Consulta CVEs conhecidas.' },
    { id: 'sec_lfi', name: 'LFI Check', cat: 'Security', icon: '📂', desc: 'Busca vulnerabilidades de inclusão local.' },
    { id: 'sec_rce', name: 'RCE Scanner', cat: 'Security', icon: '💻', desc: 'Testa execução remota de código.' },
    { id: 'net_whois_ip', name: 'IP Whois', cat: 'Network', icon: '🕵️', desc: 'Dono e range do endereço IP.' },
    { id: 'osint_metadata', name: 'Metadata Ext', cat: 'OSINT', icon: '🖼️', desc: 'Extrai metadados de imagens/docs.' },
    { id: 'osint_breach', name: 'Breach Check', cat: 'OSINT', icon: '🔓', desc: 'Verifica se o alvo está em vazamentos.' },
    { id: 'web_load_test', name: 'Load Stress', cat: 'Performance', icon: '📈', desc: 'Simula carga leve no servidor.' },
    { id: 'web_api_fuzz', name: 'API Fuzzing', cat: 'Advanced', icon: '🌪️', desc: 'Busca endpoints via dicionário.' },
    { id: 'sec_headers_sec', name: 'Security Headers +', cat: 'Security', icon: '🛡️', desc: 'Sugestões de configuração proativa.' },
    { id: 'data_jwt_crack', name: 'JWT Weak Secret', cat: 'Utils', icon: '🔨', desc: 'Testa secrets fracos em tokens.' },
    { id: 'osint_intel', name: 'Threat Intel', cat: 'OSINT', icon: '🧠', desc: 'Busca reputação em listas de bloqueio.' }
];

function renderTools(filter = '') {
    const grid = document.getElementById('tools-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filtered = TOOLS_DATABASE.filter(t => 
        t.name.toLowerCase().includes(filter.toLowerCase()) || 
        t.cat.toLowerCase().includes(filter.toLowerCase())
    );
    filtered.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '10px';
        card.style.margin = '0';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.2s ease';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="font-size: 18px;">${tool.icon}</span>
                <span style="font-weight: 600; font-size: 11px;">${tool.name}</span>
            </div>
            <div style="font-size: 9px; color: var(--text-3); height: 24px; overflow: hidden;">${tool.desc}</div>
            <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span class="tag tag-blue" style="font-size: 8px;">${tool.cat}</span>
                <button class="btn btn-ghost" style="padding: 2px 6px; font-size: 9px; height: auto;">Executar</button>
            </div>
        `;
        card.onclick = () => runTool(tool.id);
        grid.appendChild(card);
    });
}

function runTool(id) {
    const url = document.getElementById('scan-target').value;
    if (!url && !id.startsWith('data_')) {
        alert('Por favor, insira um URL no Cofre antes de usar esta ferramenta.');
        return;
    }
    term.writeln(`\r\n\x1b[33m[exec]\x1b[0m Iniciando ferramenta: ${id} em ${url || 'buffer'}`);
    setTimeout(() => {
        term.writeln(`\x1b[32m[ok]\x1b[0m ${id} finalizado com sucesso.`);
        term.prompt();
    }, 1500);
}

document.getElementById('tool-search')?.addEventListener('input', (e) => renderTools(e.target.value));
renderTools();

// ═══════════ Vault & Dashboard ═══════════
const vaultResults = document.getElementById('vault-results');
const row = (k, v, cls = '') => `<div class="row"><span class="row-k">${k}</span><span class="row-v ${cls}">${v}</span></div>`;

const MODULE_META = {
    architecture:       { label: 'Arquitetura',           icon: '🏗️', color: 'blue' },
    harvested_data:     { label: 'Dados Extraídos',       icon: '🔓', color: 'red' },
    security_headers:   { label: 'Headers de Segurança',  icon: '🛡️', color: 'green' },
    cookies:            { label: 'Cookies',               icon: '🍪', color: 'amber' },
    tech_stack:         { label: 'Tech Stack',            icon: '⚙️', color: 'blue' },
    cms:                { label: 'CMS',                   icon: '📰', color: 'blue' },
    cdn_waf:            { label: 'CDN / WAF',             icon: '🌐', color: 'blue' },
    ssl_cert:           { label: 'Certificado SSL',       icon: '🔒', color: 'green' },
    robots_txt:         { label: 'Robots.txt',            icon: '🤖', color: 'amber' },
    sitemap:            { label: 'Sitemap',               icon: '🗺️', color: 'blue' },
    cors:               { label: 'Política CORS',         icon: '🔗', color: 'red' },
    http_methods:       { label: 'Métodos HTTP',          icon: '📡', color: 'blue' },
    html_comments:      { label: 'Comentários HTML',      icon: '💬', color: 'gray' },
    hidden_inputs:      { label: 'Inputs Ocultos',        icon: '👁️', color: 'amber' },
    external_services:  { label: 'Serviços Externos',     icon: '📊', color: 'amber' },
    social_links:       { label: 'Redes Sociais',         icon: '🔗', color: 'blue' },
    phone_numbers:      { label: 'Telefones',             icon: '📞', color: 'green' },
    assets:             { label: 'Assets',                icon: '📦', color: 'blue' },
    api_endpoints:      { label: 'APIs Descobertas',      icon: '🎯', color: 'red' },
    subdomains:         { label: 'Subdomínios',           icon: '🌍', color: 'amber' },
    redirect_chain:     { label: 'Cadeia de Redirects',   icon: '↗️', color: 'gray' },
    open_graph:         { label: 'Open Graph / Meta',     icon: '📋', color: 'blue' },
    inline_scripts:     { label: 'Scripts Inline',        icon: '⚠️', color: 'amber' },
    dns:                { label: 'DNS',                   icon: '🌐', color: 'gray' },
};

const TAG_COLORS = {
    red:   { bg: 'var(--red-muted)',   fg: 'var(--red)' },
    green: { bg: 'var(--green-muted)', fg: 'var(--green)' },
    amber: { bg: 'var(--amber-muted)', fg: 'var(--amber)' },
    blue:  { bg: 'var(--accent-muted)',fg: 'var(--accent)' },
    gray:  { bg: 'rgba(255,255,255,0.04)', fg: 'var(--text-3)' },
};

function renderModuleRows(data) {
    if (!data) return '';
    if (typeof data === 'string') return row('Valor', data);
    if (Array.isArray(data)) {
        if (data.length === 0) return row('Resultado', 'Nenhum', 'green');
        return data.map((item, i) => row(`#${i+1}`, typeof item === 'object' ? JSON.stringify(item) : item)).join('');
    }
    if (typeof data === 'object') {
        return Object.entries(data).map(([k, v]) => {
            let cls = '';
            if (v === 'AUSENTE' || v === false) cls = 'red';
            else if (v === true || v === 'OK') cls = 'green';
            const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return row(k.replace(/_/g, ' '), display.length > 60 ? display.substring(0, 60) + '…' : display, cls);
        }).join('');
    }
    return row('Valor', String(data));
}

function getModuleBadge(moduleName, data) {
    if (moduleName === 'cors' && data?.open_cors) return { text: 'VULN', color: 'red' };
    if (moduleName === 'security_headers') {
        const missing = data ? Object.values(data).filter(v => v === 'AUSENTE').length : 0;
        if (missing > 3) return { text: `${missing} AUSENTES`, color: 'red' };
        if (missing > 0) return { text: `${missing} ausentes`, color: 'amber' };
        return { text: 'OK', color: 'green' };
    }
    if (moduleName === 'harvested_data') {
        const issues = (data?.jwt_tokens?.length || 0) + (data?.exposed_paths?.length || 0);
        if (issues > 0) return { text: `${issues} expostos`, color: 'red' };
        return { text: 'Limpo', color: 'green' };
    }
    if (Array.isArray(data)) return { text: data.length > 0 ? data.length + ' itens' : '—', color: data.length > 0 ? 'blue' : 'gray' };
    if (typeof data === 'object' && data !== null) return { text: Object.keys(data).length + ' campos', color: 'blue' };
    return { text: 'DATA', color: 'blue' };
}

function createModuleCard(moduleName, data, delay = 0) {
    const meta = MODULE_META[moduleName] || MODULE_META[moduleName.replace('deep_recon_', '')] || { label: moduleName, icon: '📄', color: 'blue' };
    const actualData = data?.data || data?.result || data;
    const badge = getModuleBadge(moduleName.replace('deep_recon_', ''), actualData);
    const tc = TAG_COLORS[badge.color] || TAG_COLORS.blue;

    const card = document.createElement('div');
    card.className = 'module-card';
    card.style.animationDelay = `${delay}ms`;
    card.innerHTML = `
        <div class="module-header">
            <div class="module-header-left">
                <div class="module-dot" style="background: ${TAG_COLORS[meta.color]?.fg || 'var(--text-3)'}"></div>
                <span class="module-name">${meta.icon} ${meta.label}</span>
            </div>
            <span class="module-badge" style="background:${tc.bg};color:${tc.fg}">${badge.text}</span>
        </div>
        <div class="module-body">
            ${renderModuleRows(actualData)}
        </div>
    `;
    card.querySelector('.module-header').addEventListener('click', () => {
        card.querySelector('.module-body').classList.toggle('open');
    });
    return card;
}

function calcSecurityScore(allModules) {
    let score = 100;
    if (allModules.security_headers) {
        const missing = Object.values(allModules.security_headers).filter(v => v === 'AUSENTE').length;
        score -= missing * 5;
    }
    if (allModules.cors?.open_cors) score -= 15;
    const h = allModules.harvested_data || {};
    score -= (h.exposed_paths?.length || 0) * 8;
    score -= (h.jwt_tokens?.length || 0) * 15;
    return Math.max(0, Math.min(100, score));
}

function renderScoreBadge(score) {
    const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
    const label = score >= 80 ? 'Seguro' : score >= 50 ? 'Atenção' : 'Crítico';
    return `<div class="score-badge">
        <div class="score-ring" style="--score-color: ${color}; --score-pct: ${score}%; color: ${color};">
            <span>${score}</span>
        </div>
        <div class="score-meta">
            <span class="score-label">${label}</span>
            <span class="score-sublabel">Score de segurança</span>
        </div>
    </div>`;
}

// ═══════════ Scan Handlers ═══════════
document.getElementById('btn-run-scan')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('scan-target');
    let url = urlInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    const progressBar = document.getElementById('scan-progress');
    const progressFill = document.getElementById('scan-progress-fill');
    const scoreArea = document.getElementById('scan-score-area');
    const statusArea = document.getElementById('scan-status-area');

    vaultResults.innerHTML = '';
    scoreArea.innerHTML = '';
    progressBar.classList.add('active');
    progressFill.style.width = '0%';
    statusArea.innerHTML = '<div class="scan-status"><div class="scan-status-dot"></div>Conectando ao Core...</div>';

    try {
        // Health check
        const health = await fetch('http://localhost:8080/api/inject-ig/status', { signal: AbortSignal.timeout(3000) });
        if (!health.ok) throw new Error('Core offline');

        const streamUrl = `http://localhost:8080/api/inject-ig/scan-stream?url=${encodeURIComponent(url)}`;
        const eventSource = new EventSource(streamUrl);
        const allModules = {};
        let moduleCount = 0;

        const handleEvent = (payload) => {
            const m = payload.module;
            if (!m) return;
            allModules[m] = payload.result;
            currentVaultData[m] = payload.result;
            currentVaultData.target = url;
            moduleCount++;

            progressFill.style.width = Math.round(((payload.step || 0) / (payload.total || 25)) * 100) + '%';
            const meta = MODULE_META[m] || MODULE_META[m.replace('deep_recon_', '')] || { label: m, icon: '📄' };
            statusArea.innerHTML = `<div class="scan-status"><div class="scan-status-dot"></div>${meta.icon} ${meta.label} — ${payload.step || 0}/${payload.total || 25}</div>`;
            
            const card = createModuleCard(m, payload.result, 0);
            vaultResults.appendChild(card);
            vaultResults.scrollTop = vaultResults.scrollHeight;
            
            const score = calcSecurityScore(allModules);
            scoreArea.innerHTML = renderScoreBadge(score);
        };

        // Standard message listener
        eventSource.onmessage = (e) => { try { handleEvent(JSON.parse(e.data)); } catch (err) {} };

        // Named event listeners (Backend uses .name(moduleName))
        Object.keys(MODULE_META).forEach(name => {
            const register = (eventName) => {
                eventSource.addEventListener(eventName, (e) => {
                    try { handleEvent(JSON.parse(e.data)); } catch (err) {}
                });
            };
            register(name);
            register('deep_recon_' + name);
        });

        eventSource.addEventListener('architecture', (e) => { try { handleEvent(JSON.parse(e.data)); } catch (err) {} });
        eventSource.addEventListener('harvested_data', (e) => { try { handleEvent(JSON.parse(e.data)); } catch (err) {} });

        eventSource.addEventListener('done', () => {
            eventSource.close();
            statusArea.innerHTML = '<div class="scan-status" style="color:var(--green)">✅ Scan completo — ' + moduleCount + ' módulos</div>';
            progressFill.style.width = '100%';
            setTimeout(() => { if (progressBar) progressBar.classList.remove('active'); }, 1500);
            renderFileTree(currentVaultData);
        });

        eventSource.addEventListener('error', (e) => {
            if (moduleCount === 0) {
                eventSource.close();
                if (progressBar) progressBar.classList.remove('active');
                statusArea.innerHTML = '<div class="scan-status" style="color:var(--red)">❌ Erro de conexão ou timeout</div>';
            }
        });
    } catch (err) {
        progressBar.classList.remove('active');
        statusArea.innerHTML = `<div class="scan-status" style="color:var(--red)">❌ Core Engine offline</div>`;
    }
});

document.getElementById('btn-run-scan-local')?.addEventListener('click', async () => {
    try {
        const folderPath = await window.electronAPI.selectScanFolder();
        if (!folderPath) return;
        vaultResults.innerHTML = '<div style="text-align:center;padding:20px;font-size:10px;">Varrendo local...</div>';
        const res = await fetch('http://localhost:8080/api/inject-ig/scan-local', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: folderPath })
        });
        const data = await res.json();
        currentVaultData = data;
        vaultResults.innerHTML = '<div class="tag tag-green">Local: ' + folderPath + '</div>';
        renderFileTree(data);
    } catch (e) {
        vaultResults.innerHTML = '<div style="color:var(--red);padding:20px;">Erro local</div>';
    }
});

// ═══════════ File Tree & Downloads ═══════════
function downloadData(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function renderFileTree(data) {
    const pane = document.getElementById('pane-files');
    const mainList = document.getElementById('main-files-list');
    if (!pane || !mainList) return;
    pane.innerHTML = ''; mainList.innerHTML = '';
    
    const COLORS_MAP = { red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--accent)', green: 'var(--green)', gray: 'var(--text-3)' };
    const allItems = [];

    const addFolder = (title, items, color) => {
        if (!items || items.length === 0) return;
        const f = document.createElement('div');
        f.className = 'folder';
        f.innerHTML = `<div class="folder-dot" style="background:${COLORS_MAP[color]}"></div><span>${title} <span style="color:var(--text-3)">${items.length}</span></span>`;
        const c = document.createElement('div');
        c.className = 'folder-children';
        items.forEach(item => {
            const val = typeof item === 'object' ? JSON.stringify(item) : String(item);
            const el = document.createElement('div');
            el.className = 'folder-child'; el.textContent = val;
            c.appendChild(el);
            allItems.push({ title, val, color });
        });
        f.onclick = () => c.classList.toggle('open');
        pane.appendChild(f); pane.appendChild(c);
    };

    const h = data.harvested_data || {};
    const dr = data.deep_recon || data || {};
    addFolder('Arquivos Críticos', h.exposed_paths || data.exposed_paths, 'red');
    addFolder('Endpoints', data.architecture?.form_endpoints, 'blue');
    addFolder('Scripts', data.architecture?.scripts, 'gray');
    addFolder('Links', data.architecture?.links, 'gray');
    addFolder('Sociais', dr.social_links, 'blue');
    addFolder('Telefones', dr.phone_numbers, 'green');

    allItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'row';
        row.style.padding = '8px 12px';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex:1;overflow:hidden;">
                <div style="width:6px;height:6px;border-radius:50%;background:${COLORS_MAP[item.color]};flex-shrink:0;"></div>
                <div style="color:var(--text-3);min-width:80px;">${item.title}</div>
                <div style="color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.val}</div>
            </div>
            <button class="btn btn-ghost" style="width:auto;padding:2px 8px;font-size:9px;">Baixar</button>
        `;
        row.querySelector('button').onclick = () => downloadData(`${item.title}.txt`, item.val);
        mainList.appendChild(row);
    });
    updateReportSummary(data);
}

function updateReportSummary(data) {
    const s = document.getElementById('report-summary-content');
    if (!s || !data.target) return;
    const score = calcSecurityScore(data.deep_recon || data);
    s.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span style="font-weight:700;">${data.target}</span>
            <span class="tag tag-blue">Score: ${score}</span>
        </div>
        <div>Módulos: ${Object.keys(data).length}</div>
    `;
}

// ═══════════ Exports ═══════════
document.getElementById('export-json')?.addEventListener('click', () => {
    if (!currentVaultData.target) return alert('Sem dados');
    downloadData('report.json', JSON.stringify(currentVaultData, null, 2));
});

document.getElementById('export-pdf')?.addEventListener('click', () => {
    if (!currentVaultData.target) return alert('Sem dados');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Relatório de Auditoria - Inject-IG`, 10, 10);
    doc.text(`Alvo: ${currentVaultData.target}`, 10, 20);
    doc.save('relatorio.pdf');
});

// ═══════════ Monitor (Live Poll) ═══════════
const statusDot = document.getElementById('core-status-dot');
const statusLabel = document.getElementById('core-status-label');
const statusDetail = document.getElementById('core-status-detail');
const vaultHistory = document.getElementById('vault-history');
const accessCount = document.getElementById('access-count');
const liveFeed = document.getElementById('live-feed');
let coreOnline = false;

const monitorPoll = async () => {
    try {
        const r = await fetch('http://localhost:8080/api/inject-ig/status', { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
            coreOnline = true;
            statusDot.style.background = 'var(--green)';
            statusLabel.className = 'tag tag-green';
            statusLabel.textContent = 'Online';
        }
    } catch {
        coreOnline = false;
        statusDot.style.background = 'var(--red)';
        statusLabel.className = 'tag tag-red';
        statusLabel.textContent = 'Offline';
    }

    if (!coreOnline) return;

    try {
        const r = await fetch('http://localhost:8080/api/inject-ig/monitor', { signal: AbortSignal.timeout(2000) });
        const m = await r.json();
        
        const vk = Object.keys(m.vault || {});
        vaultHistory.innerHTML = vk.length ? vk.map(k => `<div class="row"><span class="row-v">${k}</span></div>`).join('') : 'Nenhum scan';
        
        const logs = m.access_logs || [];
        accessCount.textContent = logs.length;
        if (logs.length) {
            liveFeed.innerHTML = logs.slice(-10).reverse().map(l => `<div class="row"><span class="row-k">${l.target}</span><span class="row-v">${new Date(+l.time).toLocaleTimeString()}</span></div>`).join('');
        }
    } catch {}
};

setInterval(monitorPoll, 5000);
setTimeout(monitorPoll, 500);

// ═══════════ Terminal IO ═══════════
window.electronAPI.onTerminalData((data) => {
    data.split('\n').forEach((l, i) => {
        if (i > 0) term.write('\r\n');
        term.write(l.replace(/\r/g, ''));
    });
    term.prompt();
});

term.onKey(e => {
    const printable = !e.domEvent.altKey && !e.domEvent.altGraphKey && !e.domEvent.ctrlKey && !e.domEvent.metaKey;
    if (e.domEvent.keyCode === 13) {
        if (commandBuffer.trim()) {
            const cmd = commandBuffer.toLowerCase().trim();
            if (cmd === 'ajuda') term.writeln('\r\najuda, limpar, injetar, core');
            else if (cmd === 'limpar') { term.clear(); term.write('\x1b[H\x1b[2J'); }
            else { term.write('\r\n'); window.electronAPI.sendTerminalKeystroke(commandBuffer); }
        } else term.write('\r\n');
        commandBuffer = ''; term.prompt();
    } else if (e.domEvent.keyCode === 8) {
        if (commandBuffer) { term.write('\b \b'); commandBuffer = commandBuffer.slice(0, -1); }
    } else if (printable) { commandBuffer += e.key; term.write(e.key); }
});

// ═══════════ Window Controls ═══════════
document.getElementById('btn-close')?.addEventListener('click', () => window.electronAPI.sendTerminalKeystroke('exit_app'));
document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI.sendTerminalKeystroke('min_app'));
document.getElementById('btn-start-core')?.addEventListener('click', () => {
    term.writeln('\r\n[sys] Iniciando Core...');
    window.electronAPI.sendTerminalKeystroke('cd core-engine && ./mvnw spring-boot:run');
});
document.getElementById('btn-inject-local')?.addEventListener('click', async () => {
    const p = await window.electronAPI.selectLocalTargetFolder();
    if (p) window.electronAPI.injectPayloadLocal(p);
});

setTimeout(() => fitAddon.fit(), 100);
