class OSINTApp {
    constructor() {
        this.btnRun = document.getElementById('btn-run-osint');
        this.inputTarget = document.getElementById('osint-target');
        this.resultsContainer = document.getElementById('osint-results');
        this.loader = document.getElementById('osint-loader');
        
        if (this.btnRun) {
            this.btnRun.addEventListener('click', () => this.runInvestigation());
        }
        
        if (this.inputTarget) {
            this.inputTarget.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.runInvestigation();
            });
        }
    }
    
    showLoader(show) {
        if (!this.loader) return;
        this.loader.style.display = show ? 'flex' : 'none';
        if (show) this.resultsContainer.innerHTML = '';
    }

    async runInvestigation() {
        const target = this.inputTarget.value.trim();
        if (!target) return;
        
        this.showLoader(true);
        
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
        const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(target);
        
        if (isEmail) {
            await this.investigateEmail(target);
        } else if (isIP) {
            await this.investigateIP(target);
        } else {
            this.showLoader(false);
            this.renderError("Alvo inválido. Por favor, insira um endereço de E-mail ou um Endereço IP IPv4.");
        }
    }
    
    async investigateEmail(email) {
        try {
            // Using xposedornot API (open-source breach DB)
            const response = await fetch(`https://api.xposedornot.com/v1/check-email/${email}`);
            this.showLoader(false);
            
            if (response.status === 404) {
                this.renderSafeEmail(email);
                return;
            }
            
            if (!response.ok) {
                throw new Error("Erro na API.");
            }
            
            const data = await response.json();
            
            if (data && data.breaches && data.breaches.length > 0) {
                const breachesList = data.breaches[0]; // It's an array of array in xposedornot
                this.renderBreaches(email, breachesList);
            } else {
                this.renderSafeEmail(email);
            }
        } catch (err) {
            this.showLoader(false);
            this.renderError("Falha na comunicação com os servidores de OSINT. Tente novamente mais tarde.");
            console.error(err);
        }
    }
    
    async investigateIP(ip) {
        try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`);
            this.showLoader(false);
            
            if (!response.ok) {
                throw new Error("Erro na API de IP.");
            }
            
            const data = await response.json();
            
            if (data.error) {
                this.renderError("Endereço IP inválido ou reservado.");
                return;
            }
            
            this.renderIPTelemetry(data);
        } catch (err) {
            this.showLoader(false);
            this.renderError("Falha ao coletar telemetria do IP.");
            console.error(err);
        }
    }
    
    renderSafeEmail(email) {
        this.resultsContainer.innerHTML = `
            <div class="card" style="border-color: var(--green); background: rgba(48, 209, 88, 0.05); text-align: center;">
                <div style="font-size: 32px; margin-bottom: 10px;">✅</div>
                <div class="card-title" style="color: var(--green);">Alvo Seguro</div>
                <div class="card-desc">Boas notícias! O e-mail <strong>${email}</strong> não foi encontrado em nenhum banco de dados público de vazamentos.</div>
            </div>
        `;
    }
    
    renderBreaches(email, breaches) {
        let html = `
            <div class="card" style="border-color: var(--red); background: rgba(255, 69, 58, 0.05);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                    <div>
                        <div class="card-title" style="color: var(--red); margin-bottom: 4px;">Alvo Comprometido</div>
                        <div style="font-size: 11px; color: var(--text-2); font-family: var(--mono);">${email}</div>
                    </div>
                    <div style="background: var(--red); color: white; font-weight: 900; font-size: 14px; padding: 6px 12px; border-radius: 8px;">
                        ${breaches.length} VAZAMENTOS
                    </div>
                </div>
                <div class="card-desc">As credenciais deste e-mail foram expostas nas seguintes bases de dados ou plataformas de terceiros:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; max-height: 250px; overflow-y: auto; padding-right: 5px;">
        `;
        
        breaches.forEach(b => {
            html += `<span class="tag tag-red" style="padding: 6px 10px;">${b}</span>`;
        });
        
        html += `
                </div>
            </div>
        `;
        
        this.resultsContainer.innerHTML = html;
    }
    
    renderIPTelemetry(data) {
        this.resultsContainer.innerHTML = `
            <div class="card">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="font-size: 24px;">📡</div>
                        <div>
                            <div class="card-title" style="margin-bottom: 2px;">Telemetria de IP</div>
                            <div style="font-size: 11px; font-family: var(--mono); color: var(--accent);">${data.ip}</div>
                        </div>
                    </div>
                    <div class="tag tag-blue">${data.version}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Localização</div>
                        <div style="font-size: 13px; color: var(--text-1); font-weight: 500;">${data.city || 'N/A'}, ${data.region || 'N/A'} - ${data.country_name || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Provedor (ISP)</div>
                        <div style="font-size: 13px; color: var(--text-1); font-weight: 500;">${data.org || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Coordenadas</div>
                        <div style="font-size: 13px; color: var(--text-1); font-family: var(--mono);">${data.latitude || 'N/A'}, ${data.longitude || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">ASN / Fuso Horário</div>
                        <div style="font-size: 13px; color: var(--text-1); font-family: var(--mono);">${data.asn || 'N/A'} / ${data.timezone || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderError(msg) {
        this.resultsContainer.innerHTML = `
            <div style="text-align: center; color: var(--amber); background: rgba(255, 159, 10, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 159, 10, 0.2); font-size: 12px;">
                ${msg}
            </div>
        `;
    }
}

// Inicializar globalmente assim que o DOM carregar
setTimeout(() => {
    window.osintApp = new OSINTApp();
}, 100);
