class ProMotionEngine {
    constructor() {
        this.init();
    }

    init() {
        console.log('[ProMotion] Iniciando Motor 120Hz...');
        
        // 1. Forçar GSAP a rodar na maior taxa de atualização possível (120Hz Interpolation)
        if (typeof gsap !== 'undefined') {
            gsap.ticker.fps(120);
            gsap.ticker.lagSmoothing(1000, 16); // Se travar, recupera suavemente
        }

        // 2. Injetar Aceleração de Hardware (GPU Compositing) e Suavização de Fontes
        this.injectHardwareAcceleration();
    }

    injectHardwareAcceleration() {
        if (document.getElementById('promotion-120hz-styles')) return;

        const style = document.createElement('style');
        style.id = 'promotion-120hz-styles';
        style.innerHTML = `
            /* 
             * Força o navegador a jogar toda a renderização da interface para a Placa de Vídeo (GPU)
             * Cria o efeito "Apple-like" de deslize de 120 frames por segundo 
             */
            html, body, .app {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
            }

            /* Otimização Específica para a Ilha Dinâmica e Painéis */
            #dynamic-island, .view.active, .seg-btn {
                /* Joga o elemento para uma camada 3D separada na GPU */
                transform: translateZ(0);
                backface-visibility: hidden;
                perspective: 1000px;
                
                /* Avisa o navegador com antecedência o que vai animar */
                will-change: transform, width, height, opacity, filter, border-radius;
            }
            
            /* Suavização Sub-pixel para animações CSS */
            * {
                /* Evita tearing durante as transições de expansão */
                box-sizing: border-box;
            }
        `;
        document.head.appendChild(style);
    }
}

class HyperMotionEngine {
    constructor() {
        this.active = false;
        
        // Wait for DOM to bind to the toggle
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindToggle());
        } else {
            this.bindToggle();
        }
    }

    bindToggle() {
        const toggle = document.getElementById('toggle-hypermotion');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const knob = e.target.nextElementSibling.nextElementSibling;
                const bg = e.target.nextElementSibling;
                
                if (isChecked) {
                    knob.style.transform = 'translateX(20px)';
                    bg.style.backgroundColor = '#a855f7';
                    bg.style.borderColor = '#a855f7';
                    this.toggle(true);
                } else {
                    knob.style.transform = 'translateX(0)';
                    bg.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    bg.style.borderColor = 'rgba(255,255,255,0.05)';
                    this.toggle(false);
                }
            });
        }
    }

    toggle(forceState = null) {
        this.active = forceState !== null ? forceState : !this.active;
        
        console.log(`[HyperMotion] Motor 300Hz: ${this.active ? 'ON' : 'OFF'}`);
        
        if (typeof gsap !== 'undefined') {
            if (this.active) {
                // 300 FPS Ticker and global time scale 2x
                gsap.ticker.fps(300);
                gsap.ticker.lagSmoothing(0);
                gsap.globalTimeline.timeScale(1.8); // 80% faster animations globally
                
                document.body.classList.add('hyper-motion-active');
            } else {
                // Revert to ProMotion (120Hz)
                gsap.ticker.fps(120);
                gsap.ticker.lagSmoothing(1000, 16);
                gsap.globalTimeline.timeScale(1.0);
                
                document.body.classList.remove('hyper-motion-active');
            }
        }
        
        if (window.DI_Engine) {
            // Give instant feedback on the island
            window.DI_Engine.showAction(
                this.active ? 'HyperMotion Ativado' : 'ProMotion Restaurado', 
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
                2000
            );
        }
    }
}

class DynamicIslandEngine {
    constructor() {
        this.state = {
            isExpanded: false,
            hasActiveWidget: false,
            baseWidth: 125,
            baseHeight: 37,
            expandWidth: 340,
            expandHeight: 160,
            collapseTimeout: null
        };

        this.elements = {
            di: null,
            compactText: null,
            compactIcon: null,
            expTitle: null,
            expSubtitle: null,
            expIcon: null,
            expRight: null,
            expContent: null,
            compactView: null,
            expandedView: null
        };

        this.init();
    }

    init() {
        // Run after DOM is ready
        document.addEventListener('DOMContentLoaded', () => this.bindElements());
        // Or if already ready
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            this.bindElements();
        }
    }

    bindElements() {
        this.elements.di = document.getElementById('dynamic-island');
        this.elements.compactText = document.getElementById('di-text-content');
        this.elements.compactIcon = document.getElementById('di-icon-container');
        this.elements.expTitle = document.getElementById('di-exp-title');
        this.elements.expSubtitle = document.getElementById('di-exp-subtitle');
        this.elements.expIcon = document.getElementById('di-exp-icon');
        this.elements.expRight = document.getElementById('di-exp-right');
        this.elements.expContent = document.getElementById('di-exp-content');
        this.elements.compactView = document.getElementById('di-compact-view');
        this.elements.expandedView = document.getElementById('di-expanded-view');

        if (this.elements.di) {
            let hoverTimeout;
            this.elements.di.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                if (!this.state.isExpanded) this.toggle();
            });
            this.elements.di.addEventListener('mouseleave', () => {
                hoverTimeout = setTimeout(() => {
                    if (this.state.isExpanded) this.toggle();
                }, 150);
            });
            this.elements.di.addEventListener('click', () => {
                if (!this.state.isExpanded) this.toggle();
            });
        }
    }

    injectGlobalStyles() {
        if (!document.getElementById('di-rich-styles')) {
            const style = document.createElement('style');
            style.id = 'di-rich-styles';
            style.innerHTML = `
                @keyframes eq { 0% { height: 6px; } 100% { height: 24px; } }
                @keyframes pulseWidth { 0% { width: 20%; } 100% { width: 100%; } }
                @keyframes fillRing { 0% { stroke-dasharray: 0, 100; } }
                @keyframes fillRing2 { 0% { stroke-dasharray: 0, 100; } }
            `;
            document.head.appendChild(style);
        }
    }

    setWidget(config) {
        if (typeof gsap === 'undefined' || !this.elements.di) return;

        this.injectGlobalStyles();

        this.state.hasActiveWidget = true;
        this.state.expandable = config.expandable !== false;
        if (config.expandWidth) this.state.expandWidth = config.expandWidth;
        if (config.expandHeight) this.state.expandHeight = config.expandHeight;

        const safeTitle = config.title || 'Sistema';
        if (this.elements.compactText) this.elements.compactText.textContent = safeTitle;
        if (this.elements.expTitle) this.elements.expTitle.textContent = safeTitle;
        if (config.subtitle && this.elements.expSubtitle) this.elements.expSubtitle.textContent = config.subtitle;
        
        if (config.iconSvg) {
            if (this.elements.compactIcon) this.elements.compactIcon.innerHTML = config.iconSvg;
            if (this.elements.expIcon) this.elements.expIcon.innerHTML = config.iconSvg;
        }
        
        if (config.color && this.elements.expIcon && this.elements.expRight) {
            this.elements.expIcon.style.background = config.color + '33';
            this.elements.expRight.style.color = config.color;
        }
        
        if (config.rightText && this.elements.expRight) this.elements.expRight.innerHTML = config.rightText;
        else if (this.elements.expRight) this.elements.expRight.innerHTML = '';
        
        if (config.contentHtml && this.elements.expContent) this.elements.expContent.innerHTML = config.contentHtml;
        else if (this.elements.expContent) this.elements.expContent.innerHTML = '';

        const charWidth = 7.5;
        this.state.baseWidth = Math.max(125, 80 + (safeTitle.length * charWidth));

        if (this.state.collapseTimeout) {
            clearTimeout(this.state.collapseTimeout);
        }

        if (!this.state.isExpanded) {
            gsap.to(this.elements.di, {
                width: this.state.baseWidth + 15,
                height: this.state.baseHeight + 2,
                duration: 0.15,
                yoyo: true,
                repeat: 1,
                ease: "power2.out",
                onComplete: () => {
                    gsap.to(this.elements.di, { width: this.state.baseWidth, height: this.state.baseHeight, duration: 0.3, ease: "elastic.out(1, 0.5)" });
                }
            });
        }

        if (config.durationMs && config.durationMs > 0) {
            this.state.collapseTimeout = setTimeout(() => {
                this.clear();
            }, config.durationMs);
        }
    }

    clear() {
        this.state.hasActiveWidget = false;
        if (this.state.isExpanded) {
            this.toggle();
        }
        
        if (this.elements.compactText && this.elements.compactIcon && this.elements.di) {
            gsap.to(this.elements.compactText, { opacity: 0, duration: 0.1, onComplete: () => {
                this.elements.compactText.textContent = 'inject-ig';
                this.elements.compactIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="di-icon" style="filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>';
                this.state.baseWidth = 125;
                gsap.to(this.elements.di, { width: 125, height: 37, duration: 0.4, ease: "elastic.out(1, 0.5)" });
                gsap.to(this.elements.compactText, { opacity: 1, duration: 0.2 });
            }});
        }
    }

    toggle() {
        if (!this.state.hasActiveWidget || !this.state.expandable) return;
        if (!this.elements.di || !this.elements.compactView || !this.elements.expandedView) return;
        
        this.state.isExpanded = !this.state.isExpanded;
        gsap.killTweensOf([this.elements.di, this.elements.compactView, this.elements.expandedView]);
        
        if (this.state.isExpanded) {
            gsap.to(this.elements.di, { 
                width: this.state.expandWidth, 
                height: this.state.expandHeight, 
                borderRadius: 40,
                duration: 0.6, 
                ease: "elastic.out(1, 0.85)" 
            });
            
            gsap.to(this.elements.compactView, { 
                opacity: 0, 
                scale: 0.8,
                filter: "blur(8px)", 
                duration: 0.2,
                ease: "power2.out",
                onComplete: () => this.elements.compactView.style.display = "none"
            });
            
            this.elements.expandedView.style.display = "flex";
            gsap.fromTo(this.elements.expandedView, 
                { opacity: 0, scale: 0.8, y: 15, filter: "blur(10px)" },
                { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "back.out(1.2)", delay: 0.1 }
            );
                
        } else {
            gsap.to(this.elements.expandedView, { 
                opacity: 0, 
                scale: 0.9, 
                y: -10, 
                filter: "blur(5px)",
                duration: 0.2, 
                ease: "power2.in",
                onComplete: () => this.elements.expandedView.style.display = "none"
            });
            
            this.elements.compactView.style.display = "flex";
            gsap.fromTo(this.elements.compactView,
                { opacity: 0, scale: 0.9, filter: "blur(5px)" },
                { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.4, ease: "back.out(1.2)", delay: 0.1 }
            );
            
            gsap.to(this.elements.di, { 
                width: this.state.baseWidth, 
                height: this.state.baseHeight, 
                borderRadius: 24,
                duration: 0.5, 
                ease: "elastic.out(1, 0.85)",
                delay: 0.05
            });
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // ─────────────── API VISUAL (TEMPLATES) ───────────────
    
    showRadar(color = '#22c55e') {
        const iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(34, 197, 94, 0.4));"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>';
        const widgetHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <div style="text-align: left;">
                    <div style="font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">LOCAL</div>
                    <div style="font-size: 11px; color: var(--text-3); font-family: var(--mono); margin-top: -2px;">192.168.1.1</div>
                </div>
                
                <div style="flex: 1; padding: 0 15px; position: relative; height: 30px; display: flex; align-items: center; justify-content: center;">
                    <svg width="100%" height="24" style="overflow: visible;">
                        <path d="M0,12 Q50,-8 100,12" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-dasharray="4,4"/>
                        <path id="flight-path" d="M0,12 Q50,-8 100,12" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="120" stroke-dashoffset="120">
                            <animate attributeName="stroke-dashoffset" values="120;0" dur="2s" fill="freeze" />
                        </path>
                        <circle cx="0" cy="12" r="4" fill="${color}" style="filter: drop-shadow(0 0 4px ${color});">
                            <animateMotion path="M0,12 Q50,-8 100,12" dur="2s" fill="freeze" calcMode="spline" keySplines="0.42 0 0.58 1" keyTimes="0; 1" />
                        </circle>
                    </svg>
                </div>

                <div style="text-align: right;">
                    <div style="font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">ALVO</div>
                    <div style="font-size: 11px; color: var(--text-3); font-family: var(--mono); margin-top: -2px;">10.0.0.45</div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 15px; align-items: flex-end;">
                <div style="font-size: 12px; color: var(--text-2);">
                    <span style="color: ${color}; font-weight: 600;">Rastreando</span><br>
                    Sinal forte detectado
                </div>
                <div style="text-align: right; font-size: 12px; color: var(--text-2);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: -3px;"><path d="M2 12h4l3-9 5 18 3-9h5"/></svg> 4<br>
                    Nós Ativos
                </div>
            </div>
        `;

        this.setWidget({
            title: 'Radar',
            subtitle: 'Sessão Ativa',
            iconSvg: iconSvg,
            color: color,
            rightText: 'ON',
            contentHtml: widgetHtml,
            expandable: true,
            expandWidth: 320,
            expandHeight: 120,
            durationMs: 4000
        });
    }

    showInject(color = '#ef4444') {
        const iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4));"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
        const widgetHtml = `
            <div style="margin-top: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                    <span style="color: #fff; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;">Estágios da Injeção</span>
                    <span style="color: ${color}; font-weight: 700; font-size: 14px;">3<span style="color:var(--text-3); font-size:12px;"> / 5</span></span>
                </div>
                
                <div style="display: flex; gap: 4px; height: 32px;">
                    <!-- Done -->
                    <div style="flex: 1; background: ${color}33; border: 1px solid ${color}80; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${color};"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                    <div style="flex: 1; background: ${color}33; border: 1px solid ${color}80; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${color};"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                    <div style="flex: 1; background: ${color}33; border: 1px solid ${color}80; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${color};"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                    <!-- Active -->
                    <div style="flex: 1; background: ${color}; border: 1px solid ${color}; border-radius: 6px; box-shadow: 0 0 12px ${color}80; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
                        <div style="position: absolute; left: 0; bottom: 0; height: 100%; width: 40%; background: rgba(255,255,255,0.4); animation: pulseWidth 1.5s infinite alternate ease-in-out;"></div>
                    </div>
                    <!-- Pending -->
                    <div style="flex: 1; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px;"></div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 14px; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="width: 26px; height: 26px; border-radius: 50%; background: ${color}33; display: flex; align-items: center; justify-content: center;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </div>
                    <div>
                        <div style="font-size: 9px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Payload</div>
                        <div style="font-size: 13px; color: #fff; font-weight: 600;">reverse_tcp.sh</div>
                    </div>
                    <div style="margin-left: auto; display: flex; gap: 8px;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setWidget({
            title: 'Inject',
            subtitle: 'Sessão Ativa',
            iconSvg: iconSvg,
            color: color,
            rightText: 'ON',
            contentHtml: widgetHtml,
            expandable: true,
            expandWidth: 320,
            expandHeight: 120,
            durationMs: 4000
        });
    }

    showDashboard(color = '#3b82f6') {
        const iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
        const widgetHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px;">
                <div style="flex: 1;">
                    <div style="font-size: 10px; color: ${color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Saúde do Core</div>
                    <div style="font-size: 32px; font-weight: 700; color: #fff; line-height: 1; letter-spacing: -1px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">1.4<span style="font-size: 16px; color: var(--text-3); font-weight: 600;">GB</span></div>
                    <div style="display: flex; gap: 6px; margin-top: 10px;">
                        <div style="padding: 2px 6px; background: rgba(34, 197, 94, 0.2); color: #22c55e; border-radius: 4px; font-size: 10px; font-weight: 600;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:-1px; margin-right: 2px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Stable</div>
                        <div style="padding: 2px 6px; background: rgba(255, 255, 255, 0.1); color: var(--text-2); border-radius: 4px; font-size: 10px; font-family: var(--mono);">4% CPU</div>
                    </div>
                </div>
                
                <div style="width: 76px; height: 76px; position: relative;">
                    <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; position: absolute; transform: rotate(-90deg);">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${color}33" stroke-width="3.5" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${color}" stroke-width="3.5" stroke-dasharray="75, 100" stroke-linecap="round" style="animation: fillRing 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;" />
                    </svg>
                    <svg viewBox="0 0 36 36" style="width: 70%; height: 70%; position: absolute; top: 15%; left: 15%; transform: rotate(-90deg);">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(168, 85, 247, 0.2)" stroke-width="4.5" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#a855f7" stroke-width="4.5" stroke-dasharray="45, 100" stroke-linecap="round" style="animation: fillRing2 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; stroke-dashoffset: 0;" />
                    </svg>
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    </div>
                </div>
            </div>
        `;

        this.setWidget({
            title: 'Dashboard',
            subtitle: 'Sessão Ativa',
            iconSvg: iconSvg,
            color: color,
            rightText: 'ON',
            contentHtml: widgetHtml,
            expandable: true,
            expandWidth: 320,
            expandHeight: 120,
            durationMs: 4000
        });
    }

    showDefault(title, color = '#3b82f6', iconSvg) {
        if (!iconSvg) {
            iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        }
        
        const widgetHtml = `
            <div style="display: flex; gap: 4px; height: 24px; align-items: flex-end; justify-content: center; margin-top: 10px;">
                <div style="width: 12px; background: ${color}; border-radius: 3px; animation: eq 1s infinite alternate ease-in-out;"></div>
                <div style="width: 12px; background: ${color}; border-radius: 3px; animation: eq 1.2s infinite alternate ease-in-out; animation-delay: 0.1s;"></div>
                <div style="width: 12px; background: ${color}; border-radius: 3px; animation: eq 0.8s infinite alternate ease-in-out; animation-delay: 0.2s;"></div>
                <div style="width: 12px; background: ${color}; border-radius: 3px; animation: eq 1.1s infinite alternate ease-in-out; animation-delay: 0.3s;"></div>
                <div style="width: 12px; background: ${color}; border-radius: 3px; animation: eq 0.9s infinite alternate ease-in-out; animation-delay: 0.4s;"></div>
            </div>
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; font-size: 12px; color: var(--text-2); margin-top: 12px; font-weight: 500; text-align: center;">Módulo Online e Operacional</div>
        `;

        this.setWidget({
            title: title,
            subtitle: 'Sessão Ativa',
            iconSvg: iconSvg,
            color: color,
            rightText: 'ON',
            contentHtml: widgetHtml,
            expandable: true,
            expandWidth: 320,
            expandHeight: 120,
            durationMs: 4000
        });
    }

    showAction(text, iconSvg, durationMs = 3000) {
        this.setWidget({
            title: text,
            subtitle: 'Ação Rápida',
            iconSvg: iconSvg,
            color: '#3b82f6',
            expandable: false,
            durationMs: durationMs
        });
    }
}

// Instantiate globally
window.ProMotion = new ProMotionEngine();
window.HyperMotion = new HyperMotionEngine();
window.DI_Engine = new DynamicIslandEngine();
