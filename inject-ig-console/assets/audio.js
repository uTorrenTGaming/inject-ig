// Motor de Áudio Cinematográfico (Web Audio API)
class CinematicAudioEngine {
    constructor() {
        this.enabled = true;
        this.ctx = null;
        
        // Vamos inicializar no primeiro clique do usuário
        this.initOnInteraction = () => {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            window.removeEventListener('click', this.initOnInteraction);
            window.removeEventListener('keydown', this.initOnInteraction);
        };
        
        window.addEventListener('click', this.initOnInteraction);
        window.addEventListener('keydown', this.initOnInteraction);
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
    }

    // Cria um oscilador customizado
    _createTone(freq, type, duration, vol, envelope = {}) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        // Envelope ADSR básico
        const { attack = 0.01, decay = 0.1, sustain = 0.1, release = duration } = envelope;
        const now = this.ctx.currentTime;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + attack);
        gain.gain.exponentialRampToValueAtTime(vol * sustain, now + attack + decay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay + release);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now);
        osc.stop(now + attack + decay + release);
    }

    play(soundType) {
        if (!this.enabled || !this.ctx) return;
        
        const now = this.ctx.currentTime;
        
        switch (soundType) {
            case 'hover':
                // Som de UI moderno (Aura de vidro do PS5) - Frequência alta e curtíssimo
                this._createTone(1200, 'sine', 0.05, 0.02, { attack: 0.005, decay: 0.02, release: 0.02 });
                this._createTone(800, 'triangle', 0.05, 0.01, { attack: 0.005, decay: 0.03, release: 0.01 });
                // Vibração extremamente sutil
                if (navigator.vibrate) navigator.vibrate(2);
                break;
                
            case 'click':
                // Confirmação / Enter (Impacto de vidro temperado e sub-grave)
                this._createTone(150, 'sine', 0.2, 0.2, { attack: 0.01, decay: 0.1, release: 0.1 });
                this._createTone(2400, 'sine', 0.1, 0.02, { attack: 0.005, decay: 0.05, release: 0.05 });
                if (navigator.vibrate) navigator.vibrate(10);
                break;
                
            case 'scan':
                // Boot do Console (Drone sci-fi profundo)
                this._createTone(55, 'sawtooth', 1.5, 0.05, { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.0 });
                this._createTone(110, 'sine', 1.5, 0.1, { attack: 0.3, decay: 0.4, sustain: 0.5, release: 1.2 });
                if (navigator.vibrate) navigator.vibrate([20, 100, 30, 200, 40]);
                break;
                
            case 'success':
                // Acorde cristalino
                this._createTone(523.25, 'sine', 0.4, 0.03, { attack: 0.01, decay: 0.1, release: 0.3 }); // C5
                setTimeout(() => this._createTone(659.25, 'sine', 0.4, 0.03, { attack: 0.01, decay: 0.1, release: 0.3 }), 50); // E5
                setTimeout(() => this._createTone(783.99, 'sine', 0.6, 0.03, { attack: 0.01, decay: 0.1, release: 0.5 }), 100); // G5
                if (navigator.vibrate) navigator.vibrate([10, 50, 20]);
                break;
                
            case 'error':
                // Baixo e abafado
                this._createTone(100, 'square', 0.2, 0.05, { attack: 0.01, decay: 0.1, release: 0.1 });
                this._createTone(80, 'sawtooth', 0.2, 0.05, { attack: 0.02, decay: 0.1, release: 0.1 });
                if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
                break;
                
            case 'keystroke':
                // Clique seco e mecânico
                this._createTone(400, 'square', 0.02, 0.01, { attack: 0.001, decay: 0.01, release: 0.01 });
                if (navigator.vibrate) navigator.vibrate(3);
                break;
        }
    }
}

// Substituímos o motor global para o modo Cinematográfico
window.SoundEngine = new CinematicAudioEngine();

// Shim para compatibilidade com partes antigas do código
window.RendererAudioEngine = {
    init: () => window.SoundEngine.init(),
    playHover: () => window.SoundEngine.play('hover'),
    playClick: () => window.SoundEngine.play('click'),
    playKey: () => window.SoundEngine.play('keystroke'),
    playSuccess: () => window.SoundEngine.play('success'),
    playError: () => window.SoundEngine.play('error')
};
