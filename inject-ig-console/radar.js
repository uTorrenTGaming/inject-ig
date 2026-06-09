class RadarApp {
    constructor() {
        this.containerId = 'radar-globe-container';
        this.logsContainer = document.getElementById('radar-logs');
        this.map = null;
        
        this.myLat = 0;
        this.myLng = 0;
        this.myIp = 'Local';
        
        this.pointsData = [];
        this.markers = [];
        this.polylines = [];
        
        this.isInitialized = false;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'view-radar' && mutation.target.classList.contains('active')) {
                    if (!this.isInitialized) {
                        this.init();
                    } else if (this.map) {
                        setTimeout(() => this.map.invalidateSize(), 50);
                        setTimeout(() => this.map.invalidateSize(), 300);
                    }
                }
            });
        });
        
        const viewRadar = document.getElementById('view-radar');
        if (viewRadar) observer.observe(viewRadar, { attributes: true, attributeFilter: ['class'] });
    }
    
    async init() {
        this.isInitialized = true;
        this.logMessage("Inicializando Sistema GPS de Alta Precisão...", "var(--accent)");
        
        try {
            // Pega a própria localização real do usuário
            try {
                const myLocRes = await fetch('https://ipapi.co/json/');
                const myLoc = await myLocRes.json();
                if (myLoc && myLoc.latitude) {
                    this.myLat = myLoc.latitude;
                    this.myLng = myLoc.longitude;
                    this.myIp = myLoc.ip || 'Local';
                    
                    // Gera POIs (Pontos de Interesse) falsos, mas próximos da localização real do alvo!
                    this.mockTarget = {
                        poi: [
                            { name: "Torre Celular Alpha", lat: this.myLat + (Math.random() * 0.004 - 0.002), lng: this.myLng + (Math.random() * 0.004 - 0.002), type: "tower", distance: Math.floor(Math.random() * 500 + 100) + "m", signal: "Forte" },
                            { name: "Rede WiFi Pública", lat: this.myLat + (Math.random() * 0.004 - 0.002), lng: this.myLng + (Math.random() * 0.004 - 0.002), type: "wifi", distance: Math.floor(Math.random() * 200 + 50) + "m", signal: "Médio" },
                            { name: "Câmera de Monitoramento", lat: this.myLat + (Math.random() * 0.004 - 0.002), lng: this.myLng + (Math.random() * 0.004 - 0.002), type: "cctv", distance: Math.floor(Math.random() * 300 + 50) + "m", signal: "Operacional" }
                        ]
                    };
                    
                    this.logMessage(`📍 Dispositivo Alvo Localizado: ${myLoc.city || 'Desconhecida'}`, "var(--green)");
                } else {
                    throw new Error("Localização inválida da API");
                }
            } catch (e) {
                this.myLat = -19.9167; // Fallback BH
                this.myLng = -43.9345;
                this.myIp = 'Local';
                this.mockTarget = { poi: [] };
                this.logMessage(`📍 Localização base (Fallback Offline Ativado)`, "var(--amber)");
            }
            
            // Verifica se o Leaflet foi carregado
            if (typeof L === 'undefined') {
                this.logMessage("⚠️ Erro: Biblioteca de Mapas (Leaflet) não foi carregada.", "var(--red)");
                return;
            }
            
            // Inicializa o Mapa
            this.map = L.map(this.containerId, {
                zoomControl: false,
                attributionControl: false
            }).setView([this.myLat, this.myLng], 16);
            
            // Tema Dark Cyberpunk (CartoDB Dark Matter)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                subdomains: 'abcd'
            }).addTo(this.map);
            
            // Ícone do Alvo (Pulsante)
            const targetHtml = `
                <div style="width: 24px; height: 24px; background: rgba(255, 159, 10, 0.4); border: 2px solid var(--amber); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px var(--amber);">
                    <div style="width: 8px; height: 8px; background: var(--amber); border-radius: 50%;"></div>
                </div>
                <style>
                    @keyframes mapPulse { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
                </style>
            `;
            
            const targetIcon = L.divIcon({
                className: 'target-marker',
                html: targetHtml,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            L.marker([this.myLat, this.myLng], { icon: targetIcon }).addTo(this.map)
                .bindPopup('<div style="color:#000; font-family:monospace; font-weight:bold; font-size: 12px; padding: 4px;">ALVO RASTREADO</div>');
                
            // Inicia o rastreamento dos POIs
            this.logMessage("Analisando satélites e triangulação WiFi...", "var(--text-3)");
            setTimeout(() => this.scanPOIs(), 1500);
            
        } catch (e) {
            console.error("Erro no Radar:", e);
            this.logMessage("Falha ao inicializar o mapa: " + e.message, "var(--red)");
        }
    }
    
    async scanPOIs() {
        if (!this.mockTarget || !this.mockTarget.poi) return;
        
        for (let i = 0; i < this.mockTarget.poi.length; i++) {
            const poi = this.mockTarget.poi[i];
            
            // Simula delay de triangulação
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
            
            // Ícone do POI
            const poiIcon = L.divIcon({
                className: 'poi-marker',
                html: '<div style="width: 14px; height: 14px; background: rgba(10, 132, 255, 0.4); border: 2px solid var(--accent); border-radius: 50%; box-shadow: 0 0 10px var(--accent);"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });
            
            L.marker([poi.lat, poi.lng], { icon: poiIcon }).addTo(this.map)
                .bindPopup(`<div style="color:#000; font-family:monospace; font-weight:bold; font-size: 11px;">${poi.name}</div>`);
                
            // Linha que liga o alvo ao POI
            L.polyline([[this.myLat, this.myLng], [poi.lat, poi.lng]], {
                color: 'var(--accent)',
                weight: 2,
                opacity: 0.6,
                dashArray: '5, 10',
                lineCap: 'square'
            }).addTo(this.map);
            
            this.logPOIConnection(poi);
        }
        
        this.logMessage("Triangulação de alta precisão concluída. Precisão estimada: 4 metros.", "var(--green)");
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
    
    logPOIConnection(poi) {
        let icon = '<circle cx="12" cy="12" r="10"></circle>';
        if (poi.type === 'tower') icon = '<path d="M4 14.899A7 7 0 1 1 20 14.9M8.5 10.5A3.5 3.5 0 1 1 15.5 10.5M12 4v16M12 20h.01"></path>';
        if (poi.type === 'wifi') icon = '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"></path>';
        if (poi.type === 'cctv') icon = '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle>';

        const div = document.createElement('div');
        div.style.padding = '12px';
        div.style.background = 'rgba(255, 255, 255, 0.03)';
        div.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        div.style.borderRadius = '12px';
        div.style.cursor = 'pointer';
        div.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div style="color: #fff; font-weight: 500; font-family: -apple-system, sans-serif; font-size: 13px; letter-spacing: 0.5px;">${poi.name}</div>
                <div style="background: rgba(10, 132, 255, 0.15); color: var(--accent); font-size: 10px; padding: 3px 8px; border-radius: 8px; font-weight: 600;">Dist: ${poi.distance}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" stroke-width="2">${icon}</svg>
                <div style="font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: -apple-system, sans-serif;">
                    Sinal: <span style="color: var(--amber); font-weight: bold;">${poi.signal}</span>
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
        
        // Clicou = Foca e dá zoom na coordenada do POI no mapa
        div.addEventListener('click', () => {
            if (this.map) {
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
                
                // Anima o Mapa (Focus on POI)
                this.map.flyTo([poi.lat, poi.lng], 18, {
                    animate: true,
                    duration: 1.5
                });
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
setTimeout(() => {
    window.radarApp = new RadarApp();
}, 100);
