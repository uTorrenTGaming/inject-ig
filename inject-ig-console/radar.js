class RadarApp {
    constructor() {
        this.container = document.getElementById('radar-globe-container');
        this.logsContainer = document.getElementById('radar-logs');
        this.globe = null;
        
        this.myLat = 0;
        this.myLng = 0;
        this.myIp = 'Local';
        
        this.ipCache = new Map(); // Para não fazer request duplo no mesmo IP
        this.arcsData = []; // Lista de conexões para renderizar
        this.knownIps = new Set(); // Para não flodar o painel
        
        this.isInitialized = false;
        
        // Espera a view ficar ativa para renderizar e evitar bugs do WebGL com div display:none
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'view-radar' && mutation.target.classList.contains('active')) {
                    if (!this.isInitialized) {
                        this.init();
                    } else {
                        // Force resize se a janela mudou
                        if (this.globe) {
                            const width = this.container.clientWidth;
                            const height = this.container.clientHeight;
                            this.globe.width(width).height(height);
                        }
                    }
                }
            });
        });
        
        const viewRadar = document.getElementById('view-radar');
        if (viewRadar) observer.observe(viewRadar, { attributes: true, attributeFilter: ['class'] });
    }
    
    async init() {
        this.isInitialized = true;
        this.logMessage("Inicializando Radar 3D...", "var(--accent)");
        
        try {
            // Pega a própria localização (com fallback para evitar crash na tela preta)
            try {
                const myLocRes = await fetch('https://ipapi.co/json/');
                const myLoc = await myLocRes.json();
                if (myLoc && myLoc.latitude) {
                    this.myLat = myLoc.latitude;
                    this.myLng = myLoc.longitude;
                    this.myIp = myLoc.ip || 'Local';
                    this.logMessage(`📍 Localização base definida: ${myLoc.city || 'Desconhecida'}, ${myLoc.country_name || 'Desconhecido'}`, "var(--green)");
                } else {
                    throw new Error("Localização inválida da API");
                }
            } catch (e) {
                this.myLat = -23.5505; // Fallback SP Brasil
                this.myLng = -46.6333;
                this.myIp = 'Local';
                this.logMessage(`📍 Localização base (Fallback Offline Ativado)`, "var(--amber)");
            }
            
            // Verifica se o Globe foi carregado
            if (typeof Globe === 'undefined') {
                this.logMessage("⚠️ Erro: Biblioteca 3D (Globe.gl) não foi carregada pelo sistema.", "var(--red)");
                return;
            }
            
            // Inicializa o Globo
            const width = this.container.clientWidth || window.innerWidth;
            const height = this.container.clientHeight || window.innerHeight;
            
            this.globe = Globe()(this.container)
                .width(width)
                .height(height)
                .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
                .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
                .backgroundColor('rgba(0,0,0,0)')
                .arcStartLat(d => d.startLat)
                .arcStartLng(d => d.startLng)
                .arcEndLat(d => d.endLat)
                .arcEndLng(d => d.endLng)
                .arcColor(() => 'rgba(10, 132, 255, 0.8)')
                .arcDashLength(0.4)
                .arcDashGap(0.2)
                .arcDashAnimateTime(1500)
                .arcAltitude(0.2)
                .arcStroke(0.5);
                
            // Posiciona a câmera olhando pro Brasil/Local atual
            this.globe.pointOfView({ lat: this.myLat, lng: this.myLng, altitude: 2 });
            
            // Adiciona um ponto fixo luminoso pro usuário
            this.globe.pointsData([{ lat: this.myLat, lng: this.myLng, size: 0.1, color: 'red' }])
                .pointColor('color')
                .pointAltitude('size')
                .pointRadius(0.5);
                
            // Inicia o Loop de rastreamento do Netstat
            this.logMessage("Escaneando camada TCP...", "var(--text-3)");
            this.scanTraffic();
            setInterval(() => this.scanTraffic(), 5000);
            
            // Listener pra resize
            window.addEventListener('resize', () => {
                if (this.globe && document.getElementById('view-radar').classList.contains('active')) {
                    this.globe.width(this.container.clientWidth).height(this.container.clientHeight);
                }
            });
            
        } catch (e) {
            console.error("Erro no Radar:", e);
            this.logMessage("Falha ao inicializar o globo: " + e.message, "var(--red)");
        }
    }
    
    async scanTraffic() {
        if (!window.electronAPI || !window.electronAPI.getNetworkTraffic) return;
        
        const ips = await window.electronAPI.getNetworkTraffic();
        
        for (const ip of ips) {
            if (!this.knownIps.has(ip)) {
                this.knownIps.add(ip);
                this.resolveAndDrawIP(ip);
            }
        }
    }
    
    async resolveAndDrawIP(ip) {
        let geo = this.ipCache.get(ip);
        
        if (!geo) {
            try {
                const res = await fetch(`https://ipapi.co/${ip}/json/`);
                if (!res.ok) return;
                geo = await res.json();
                
                if (geo.error) return; // IPs reservados ou erro de limite
                
                this.ipCache.set(ip, geo);
                
                // Desenha na interface log
                this.logConnection(geo);
                
                // Desenha arco no globo
                this.arcsData.push({
                    startLat: this.myLat,
                    startLng: this.myLng,
                    endLat: geo.latitude,
                    endLng: geo.longitude
                });
                
                this.globe.arcsData([...this.arcsData]); // Força re-render
                
            } catch (err) {
                // Ignore silent fetch errors
            }
        }
    }
    
    logMessage(msg, color) {
        const div = document.createElement('div');
        div.style.padding = '8px 12px';
        div.style.background = 'rgba(255, 255, 255, 0.02)';
        div.style.borderLeft = `3px solid ${color}`;
        div.style.color = 'var(--text-2)';
        div.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
        div.style.fontSize = '11px';
        div.style.borderRadius = '6px';
        div.style.backdropFilter = 'blur(10px)';
        div.innerHTML = msg;
        
        this.logsContainer.prepend(div);
        
        // Manter máximo 10 logs de sistema
        while (this.logsContainer.children.length > 25) {
            this.logsContainer.removeChild(this.logsContainer.lastChild);
        }
    }
    
    logConnection(geo) {
        const flag = geo.country_name || 'Desconhecido';
        const isp = geo.org || 'ISP Desconhecido';
        
        const div = document.createElement('div');
        div.style.padding = '12px';
        div.style.background = 'rgba(255, 255, 255, 0.03)';
        div.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        div.style.borderRadius = '12px';
        div.style.cursor = 'pointer';
        div.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div style="color: #fff; font-weight: 500; font-family: -apple-system, sans-serif; font-size: 13px; letter-spacing: 0.5px;">${geo.ip}</div>
                <div style="background: rgba(48, 209, 88, 0.15); color: var(--green); font-size: 10px; padding: 3px 8px; border-radius: 8px; font-weight: 600;">${flag}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path><circle cx="12" cy="9" r="2"></circle></svg>
                <div style="font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: -apple-system, sans-serif;">
                    ${isp}
                </div>
            </div>
        `;
        
        // Efeito visual no hover (Apple style subtle lift)
        div.addEventListener('mouseenter', () => {
            div.style.background = 'rgba(255, 255, 255, 0.08)';
            div.style.transform = 'translateY(-2px)';
            div.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
            div.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        });
        div.addEventListener('mouseleave', () => {
            div.style.background = 'rgba(255, 255, 255, 0.03)';
            div.style.transform = 'translateY(0)';
            div.style.boxShadow = 'none';
            div.style.borderColor = 'rgba(255, 255, 255, 0.05)';
        });
        
        // Clicou = Foca e dá zoom na coordenada do IP no globo
        div.addEventListener('click', () => {
            if (this.globe) {
                // Remove destaque anterior
                Array.from(this.logsContainer.children).forEach(c => {
                    if (c.dataset.isLog === 'true') {
                        c.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        c.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                });
                
                // Aplica destaque moderno (Active state)
                div.style.borderColor = 'var(--accent)';
                div.style.background = 'rgba(10, 132, 255, 0.1)';
                
                // Anima o globo 3D
                this.globe.pointOfView({ lat: geo.latitude, lng: geo.longitude, altitude: 0.6 }, 1500);
            }
        });
        
        div.dataset.isLog = 'true';
        this.logsContainer.prepend(div);
        
        while (this.logsContainer.children.length > 25) {
            this.logsContainer.removeChild(this.logsContainer.lastChild);
        }
    }
}

// Inicializar globalmente
document.addEventListener('DOMContentLoaded', () => {
    window.radarApp = new RadarApp();
});
