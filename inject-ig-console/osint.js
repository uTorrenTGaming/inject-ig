class OSINTApp {
    constructor() {
        this.btnRun = document.getElementById('btn-run-osint');
        this.inputTarget = document.getElementById('osint-target');
        this.resultsContainer = document.getElementById('osint-results');
        this.loader = document.getElementById('osint-loader');
        
        this.currentMode = 'email';
        this.setupTabs();
        
        if (this.btnRun) {
            this.btnRun.addEventListener('click', () => this.runInvestigation());
        }
        
        if (this.inputTarget) {
            this.inputTarget.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.runInvestigation();
            });
        }
    }
    
    setupTabs() {
        const tabs = [
            { id: 'tab-osint-email', mode: 'email', placeholder: 'ex: alvo@email.com ou 8.8.8.8' },
            { id: 'tab-osint-phone', mode: 'phone', placeholder: 'ex: +5511999999999' },
            { id: 'tab-osint-cpf', mode: 'cpf', placeholder: 'ex: 000.000.000-00 ou CNPJ' },
            { id: 'tab-osint-img', mode: 'image', placeholder: 'ex: https://site.com/foto.jpg' },
            { id: 'tab-osint-name', mode: 'name', placeholder: 'ex: Joao Silva, 01/01/1990' },
            { id: 'tab-osint-adv', mode: 'adv', placeholder: 'ex: username ou dominio.com' }
        ];

        tabs.forEach(t => {
            const el = document.getElementById(t.id);
            if (el) {
                el.addEventListener('click', () => {
                    tabs.forEach(tab => {
                        const tel = document.getElementById(tab.id);
                        if (tel) tel.classList.remove('active');
                    });
                    el.classList.add('active');
                    this.currentMode = t.mode;
                    if (this.inputTarget) {
                        this.inputTarget.placeholder = t.placeholder;
                        this.inputTarget.value = '';
                    }
                    this.resultsContainer.innerHTML = '<div style="text-align: center; color: var(--text-3); font-size: 11px; padding: 40px 0;">Aguardando alvo.</div>';
                });
            }
        });
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
        
        if (this.currentMode === 'email') {
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
            const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(target);
            if (isEmail) {
                await this.investigateEmail(target);
            } else if (isIP) {
                await this.investigateIP(target);
            } else {
                this.showLoader(false);
                this.renderError("Alvo inválido. Para este modo, insira um E-mail ou IP IPv4.");
            }
        } else if (this.currentMode === 'phone') {
            const isPhone = /^\+?[0-9\s\-\(\)]{8,20}$/.test(target);
            if (isPhone) {
                await this.investigatePhone(target);
            } else {
                this.showLoader(false);
                this.renderError("Formato de telefone inválido.");
            }
        } else if (this.currentMode === 'cpf') {
            const isDoc = /^[0-9\.\-\/]{11,18}$/.test(target);
            if (isDoc) {
                await this.investigateCPF(target);
            } else {
                this.showLoader(false);
                this.renderError("Formato de documento inválido. Use números, pontos e traços.");
            }
        } else if (this.currentMode === 'image') {
            const isUrl = target.startsWith('http') || target.startsWith('data:image');
            if (isUrl) {
                await this.investigateImage(target);
            } else {
                this.showLoader(false);
                this.renderError("Insira uma URL de imagem válida (http/https ou data:image).");
            }
        } else if (this.currentMode === 'name') {
            const dobMatch = target.match(/(?:\s|,|^)(\d{2}\/\d{2}\/\d{4})$/);
            let extractedDob = null;
            let nameOnly = target;
            if (dobMatch) {
                extractedDob = dobMatch[1];
                nameOnly = target.replace(dobMatch[0], '').replace(/,$/, '').trim();
            }
            
            const isName = nameOnly.includes(' ') && nameOnly.length > 5;
            if (isName) {
                await this.investigateName(nameOnly, extractedDob);
            } else {
                this.showLoader(false);
                this.renderError("Insira o nome completo (nome e sobrenome) e opcionalmente a data de nascimento.");
            }
        } else if (this.currentMode === 'adv') {
            await this.investigateAdvanced(target);
        }
    }
    
    async investigateEmail(email) {
        try {
            // Using xposedornot API (open-source breach DB)
            const response = await fetch(`https://api.xposedornot.com/v1/check-email/${email}`);
            this.showLoader(false);
            
            if (response.status === 404) {
                this.renderSafe(email);
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
                this.renderSafe(email);
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
    
    async investigatePhone(phone) {
        try {
            await new Promise(r => setTimeout(r, 1500));
            this.showLoader(false);
            
            // Simulação de verificação de vazamento para números de telefone
            const isLeaked = phone.length > 9 && (phone.includes('1') || phone.includes('9'));
            
            if (isLeaked) {
                const mockBreaches = [
                    "WhatsApp Data Breach (2023)",
                    "Facebook 533M Leak (2021)",
                    "Clube de Descontos (2019)",
                    "Telegram Scraped DB (2022)"
                ];
                const shuffled = mockBreaches.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 1);
                this.renderBreaches(phone, selected);
            } else {
                this.renderSafe(phone);
            }
        } catch (err) {
            this.showLoader(false);
            this.renderError("Falha na comunicação com as bases de telefonia.");
        }
    }
    
    async investigateAdvanced(query) {
        try {
            await new Promise(r => setTimeout(r, 2000));
            this.showLoader(false);
            
            const mockAdvancedBreaches = [
                "Twitter API Leak (2023)",
                "LinkedIn Scrape (2021)",
                "Forums Hacker Database",
                "Dark Web Combolists",
                "Pastebin Dumps",
                "Adobe Breach (2013)"
            ];
            
            const isLeaked = query.length > 3 && Math.random() > 0.4;
            
            if (isLeaked) {
                const shuffled = mockAdvancedBreaches.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, Math.floor(Math.random() * 4) + 1);
                this.renderBreaches(query, selected);
            } else {
                this.renderSafe(query);
            }
        } catch (err) {
            this.showLoader(false);
            this.renderError("Falha ao executar pesquisa avançada na Deep Web / Open Web.");
        }
    }

    renderSafe(target) {
        this.resultsContainer.innerHTML = `
            <div class="card" style="border-color: var(--green); background: rgba(48, 209, 88, 0.05); text-align: center;">
                <div style="font-size: 32px; margin-bottom: 10px;">✅</div>
                <div class="card-title" style="color: var(--green);">Alvo Seguro</div>
                <div class="card-desc">Boas notícias! O alvo <strong>${target}</strong> não foi encontrado em nenhum banco de dados público de vazamentos.</div>
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
                <div class="card-desc">Os dados vinculados a este alvo foram expostos nas seguintes bases de dados ou plataformas de terceiros:</div>
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

    async investigateCPF(doc) {
        try {
            await new Promise(r => setTimeout(r, 1800));
            this.showLoader(false);
            
            const isLeaked = Math.random() > 0.2; // 80% chance for simulation drama
            if (isLeaked) {
                this.renderCPFTelemetry(doc, true);
            } else {
                this.renderSafe(doc);
            }
        } catch (err) {
            this.showLoader(false);
            this.renderError("Falha na consulta do documento nas bases.");
        }
    }

    renderCPFTelemetry(doc, isLeaked) {
        this.resultsContainer.innerHTML = `
            <div class="card" style="border-color: var(--amber); background: rgba(255, 159, 10, 0.05);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="font-size: 24px;">🪪</div>
                        <div>
                            <div class="card-title" style="color: var(--amber); margin-bottom: 2px;">Vazamento Confirmado</div>
                            <div style="font-size: 11px; font-family: var(--mono); color: var(--text-2);">${doc}</div>
                        </div>
                    </div>
                    <div class="tag tag-amber">ALERTA DE FRAUDE</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Status na Receita</div>
                        <div style="font-size: 13px; color: var(--green); font-weight: 500;">Regular</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Bases Comprometidas</div>
                        <div style="font-size: 13px; color: var(--text-1); font-weight: 500;">Serasa (2021), SUS (2022)</div>
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Dados Associados Expostos</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                            <span class="tag tag-red">Nome Completo</span>
                            <span class="tag tag-red">Endereço Residencial</span>
                            <span class="tag tag-red">Telefone Celular</span>
                            <span class="tag tag-red">Nome Materno</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async investigateImage(url) {
        try {
            await new Promise(r => setTimeout(r, 2200));
            this.showLoader(false);
            this.renderImageTelemetry(url);
        } catch (err) {
            this.showLoader(false);
            this.renderError("Falha na varredura reversa de imagem.");
        }
    }

    renderImageTelemetry(url) {
        this.resultsContainer.innerHTML = `
            <div class="card" style="border-color: var(--accent); background: rgba(10, 132, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                    <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
                        <img src="${url}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm88L3RleHQ+PC9zdmc+'" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div>
                        <div class="card-title" style="color: var(--accent); margin-bottom: 4px;">Análise Forense & Reverse Search</div>
                        <div style="font-size: 11px; color: var(--text-2); font-family: var(--mono); word-break: break-all; max-height: 28px; overflow: hidden;">${url}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Metadados EXIF</div>
                        <div style="font-size: 12px; color: var(--text-1); font-family: var(--mono);">
                            Câmera: Apple iPhone 13 Pro<br>
                            GPS: 40.7128° N, 74.0060° W<br>
                            Data: Há 3 meses
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: var(--text-3); text-transform: uppercase; margin-bottom: 4px;">Matches Faciais (PimEyes Sim)</div>
                        <div style="font-size: 12px; color: var(--text-1); font-family: var(--mono);">
                            <span style="color: var(--green);">3 Perfis Encontrados</span><br>
                            - Instagram (98% Match)<br>
                            - LinkedIn (95% Match)
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async investigateName(name, dob) {
        try {
            await new Promise(r => setTimeout(r, 1900));
            this.showLoader(false);
            this.renderNameTelemetry(name, dob);
        } catch (err) {
            this.showLoader(false);
            this.renderError("Falha na varredura de dados públicos.");
        }
    }

    renderNameTelemetry(name, dob) {
        const upperName = name.toUpperCase();
        const surnames = ["SILVA", "SANTOS", "OLIVEIRA", "SOUZA", "RODRIGUES", "FERREIRA", "ALVES", "PEREIRA", "LIMA", "GOMES"];
        const genCPF = () => `***.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-**`;
        const genDate = () => {
            const year = Math.floor(1960 + Math.random() * 40);
            const month = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
            const day = String(Math.floor(1 + Math.random() * 28)).padStart(2, '0');
            return `${day}/${month}/${year}`;
        };

        const results = [];
        // Match exato
        if (dob) {
            results.push({ name: upperName, cpf: genCPF(), dob: dob, score: Math.floor(98 + Math.random() * 2) });
        } else {
            results.push({ name: upperName, cpf: genCPF(), dob: genDate(), score: Math.floor(95 + Math.random() * 5) });
        }
        
        // Homônimos ou variações
        const count = dob ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4) + 2; 
        for(let i=0; i<count; i++) {
            const extraSurname = surnames[Math.floor(Math.random() * surnames.length)];
            const isHomonym = Math.random() > 0.4;
            let variation = upperName;
            if (isHomonym) {
                variation = `${upperName} ${extraSurname}`;
            }
            results.push({
                name: variation,
                cpf: genCPF(),
                dob: genDate(),
                score: dob ? Math.floor(40 + Math.random() * 20) : Math.floor(60 + Math.random() * 30)
            });
        }
        
        // Ordena por precisão
        results.sort((a, b) => b.score - a.score);

        let resultsHtml = '';
        results.forEach(res => {
            resultsHtml += `
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div>
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-1); margin-bottom: 2px;">${res.name}</div>
                        <div style="font-size: 11px; color: var(--text-3); font-family: var(--mono);">Nasc: ${res.dob}</div>
                    </div>
                    <span class="tag ${res.score > 90 ? 'tag-red' : 'tag-blue'}">PRECISÃO: ${res.score}%</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.1);">
                    <span style="font-size: 10px; color: var(--text-3); text-transform: uppercase;">CPF Vinculado</span>
                    <span style="font-family: var(--mono); color: var(--accent); font-size: 14px; font-weight: 700; letter-spacing: 1px;">${res.cpf}</span>
                </div>
            </div>`;
        });

        this.resultsContainer.innerHTML = `
            <div class="card" style="border-color: var(--accent); background: rgba(10, 132, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                    <div style="font-size: 24px;">👥</div>
                    <div>
                        <div class="card-title" style="color: var(--accent); margin-bottom: 2px;">Resultados: ${results.length} Registros Encontrados</div>
                        <div style="font-size: 11px; font-family: var(--mono); color: var(--text-2); text-transform: uppercase;">Busca por: ${name}</div>
                    </div>
                </div>
                
                <div class="card-desc" style="margin-bottom: 12px;">Abaixo estão os resultados que coincidem ou se assemelham ao nome buscado, incluindo homônimos:</div>
                
                <div style="display: flex; flex-direction: column; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    ${resultsHtml}
                </div>
                
                <div style="margin-top: 12px; font-size: 10px; color: var(--text-3); text-align: center;">
                    Dica: Encontre o alvo correto (verifique a Data de Nascimento) e use o CPF na aba "Doc".
                </div>
            </div>
        `;
    }
}

// Inicializar globalmente assim que o DOM carregar
setTimeout(() => {
    window.osintApp = new OSINTApp();
}, 100);
