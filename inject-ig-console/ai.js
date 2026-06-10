class GhostAIAssistant {
    constructor() {
        this.systemPrompt = { 
            role: 'system', 
            content: 'Você é o Assistente Fantasma, uma Inteligência Artificial de elite focada em cibersegurança, forense digital e pentest. Você está integrado ao software inject-ig e roda de forma offline e invisível. REGRA CRÍTICA E ABSOLUTA: Você deve responder TODAS as interações EXCLUSIVAMENTE em Português do Brasil (PT-BR). Sob nenhuma circunstância use inglês ou outras línguas.'
        };
        
        // Load persistent memory
        const savedMemory = localStorage.getItem('ghost_ai_memory');
        if (savedMemory) {
            try {
                this.messages = JSON.parse(savedMemory);
            } catch (e) {
                this.messages = [this.systemPrompt];
            }
        } else {
            this.messages = [this.systemPrompt];
        }

        this.modelName = 'phi3'; // Default fallback (pulled by installer)
        this.isChecking = false;
        
        // DOM Elements
        this.viewAi = document.getElementById('view-ai');
        this.offlineState = document.getElementById('ai-offline-state');
        this.onlineState = document.getElementById('ai-online-state');
        this.badge = document.getElementById('ai-model-badge');
        
        this.chatHistory = document.getElementById('ai-chat-history');
        this.input = document.getElementById('ai-input');
        this.btnSend = document.getElementById('btn-ai-send');
        this.btnClear = document.getElementById('btn-ai-clear');
        
        this.initEvents();
        this.restoreVisualHistory();
        
        // Sempre checa a engine no boot
        setTimeout(() => this.checkEngine(), 500);
    }
    
    restoreVisualHistory() {
        // Pula o systemPrompt (índice 0)
        for (let i = 1; i < this.messages.length; i++) {
            const msg = this.messages[i];
            this.appendMessage(msg.role, msg.content, false);
        }
    }
    
    saveMemory() {
        localStorage.setItem('ghost_ai_memory', JSON.stringify(this.messages));
    }
    
    initEvents() {
        this.btnSend.addEventListener('click', () => this.sendMessage());
        
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            if (this.value === '') this.style.height = 'auto';
        });
        
        this.btnClear.addEventListener('click', () => {
            this.messages = [this.systemPrompt];
            this.saveMemory();
            this.chatHistory.innerHTML = `
                <div class="ai-msg ai-msg-bot" style="align-self: flex-start; background: rgba(255, 255, 255, 0.05); padding: 12px 16px; border-radius: 16px; border-bottom-left-radius: 4px; max-width: 80%; color: var(--text-1); font-size: 14px; line-height: 1.5; font-family: -apple-system, sans-serif; border: 1px solid rgba(255,255,255,0.05);">
                    Memória neural formatada com sucesso. Estou pronto para uma nova operação.
                </div>
            `;
        });
    }
    
    async checkEngine() {
        if (this.isChecking) return;
        this.isChecking = true;
        
        try {
            const res = await window.electronAPI.checkAIEngine();
            if (res.online && res.models.length > 0) {
                // Pega o primeiro modelo disponível como padrão
                this.modelName = res.models[0].name;
                this.badge.innerText = `${this.modelName.toUpperCase()} (Portátil Seguro)`;
                
                this.offlineState.style.display = 'none';
                this.onlineState.style.display = 'flex';
            } else {
                // Motor offline ou sem modelos: ativa auto-instalador
                this.offlineState.style.display = 'flex';
                this.onlineState.style.display = 'none';
                this.runAutoInstaller();
            }
        } catch (e) {
            this.offlineState.style.display = 'flex';
            this.onlineState.style.display = 'none';
            this.runAutoInstaller();
        }
        
        this.isChecking = false;
    }
    
    async runAutoInstaller() {
        if (this.isInstalling) return;
        this.isInstalling = true;
        
        const log = document.getElementById('ai-installer-log');
        const prog = document.getElementById('ai-installer-progress');
        
        // Passo 1: Motor
        prog.style.width = '20%';
        
        const engRes = await window.electronAPI.installAIEngine();
        if (!engRes.success) {
            log.innerText = "FALHA AO INJETAR MOTOR: " + engRes.error;
            log.style.color = 'var(--red)';
            this.isInstalling = false;
            return;
        }
        
        // Passo 2: Pull Modelo
        prog.style.width = '40%';
        
        const pullRes = await window.electronAPI.pullAIModel();
        if (!pullRes.success) {
            log.innerText = "ERRO AO BAIXAR REDE NEURAL: " + pullRes.error;
            log.style.color = 'var(--red)';
            this.isInstalling = false;
            return;
        }
        
        prog.style.width = '100%';
        log.innerText = "INSTALAÇÃO CONCLUÍDA COM SUCESSO!";
        
        // Destranca o chat após 2 segundos
        setTimeout(() => {
            this.isInstalling = false;
            this.checkEngine();
        }, 2000);
    }
    
    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;
        
        // Adiciona a mensagem do user na tela
        this.appendMessage('user', text);
        this.input.value = '';
        this.input.style.height = 'auto';
        
        // Mostra o loader de digitando
        const loaderId = this.appendLoader();
        
        // Monta o histórico pro Ollama
        this.messages.push({ role: 'user', content: text });
        
        try {
            const res = await window.electronAPI.sendAIMessage(this.modelName, this.messages);
            
            this.removeLoader(loaderId);
            
            if (res.success) {
                const reply = res.message.content;
                this.messages.push({ role: 'assistant', content: reply });
                this.appendMessage('assistant', reply);
                this.saveMemory(); // Persist AI state
            } else {
                this.appendMessage('system', 'Erro de conexão fantasma: ' + res.error);
                this.messages.pop(); // Remove a última mensagem falha da memória
                this.saveMemory(); // Persist state removal
            }
        } catch (e) {
            this.removeLoader(loaderId);
            this.appendMessage('system', 'Erro crítico no motor AI local.');
            this.messages.pop();
        }
    }
    
    appendMessage(role, text) {
        const div = document.createElement('div');
        div.style.padding = '12px 16px';
        div.style.borderRadius = '16px';
        div.style.maxWidth = '80%';
        div.style.fontSize = '14px';
        div.style.lineHeight = '1.5';
        div.style.fontFamily = '-apple-system, sans-serif';
        div.style.whiteSpace = 'pre-wrap';
        
        if (role === 'user') {
            div.style.alignSelf = 'flex-end';
            div.style.background = 'var(--accent)';
            div.style.color = '#fff';
            div.style.borderBottomRightRadius = '4px';
        } else if (role === 'assistant') {
            div.style.alignSelf = 'flex-start';
            div.style.background = 'rgba(255, 255, 255, 0.05)';
            div.style.border = '1px solid rgba(255,255,255,0.05)';
            div.style.color = 'var(--text-1)';
            div.style.borderBottomLeftRadius = '4px';
        } else {
            div.style.alignSelf = 'center';
            div.style.background = 'rgba(220, 38, 38, 0.1)';
            div.style.color = 'var(--red)';
            div.style.fontSize = '12px';
            div.style.borderRadius = '8px';
        }
        
        div.innerText = text;
        this.chatHistory.appendChild(div);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
    
    appendLoader() {
        const id = 'loader-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.style.alignSelf = 'flex-start';
        div.style.background = 'rgba(255, 255, 255, 0.05)';
        div.style.border = '1px solid rgba(255,255,255,0.05)';
        div.style.padding = '12px 16px';
        div.style.borderRadius = '16px';
        div.style.borderBottomLeftRadius = '4px';
        div.innerHTML = `
            <div style="display: flex; gap: 4px; align-items: center; height: 20px;">
                <div style="width: 6px; height: 6px; background: var(--text-3); border-radius: 50%; animation: pulse 1.5s infinite 0s;"></div>
                <div style="width: 6px; height: 6px; background: var(--text-3); border-radius: 50%; animation: pulse 1.5s infinite 0.2s;"></div>
                <div style="width: 6px; height: 6px; background: var(--text-3); border-radius: 50%; animation: pulse 1.5s infinite 0.4s;"></div>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.4; }
                    50% { transform: scale(1.2); opacity: 1; }
                }
            </style>
        `;
        
        this.chatHistory.appendChild(div);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
        return id;
    }
    
    removeLoader(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
}

setTimeout(() => {
    window.ghostAI = new GhostAIAssistant();
}, 100);
