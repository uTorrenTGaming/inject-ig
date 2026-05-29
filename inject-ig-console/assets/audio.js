// Motor de Áudio Ciber-Tecnológico (Sintetizador Matemático)
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterVolume = 0.15; // Volume sutil e premium
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(frequency, type, duration, volMod = 1) {
        if (!this.enabled || !this.ctx) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        gainNode.gain.setValueAtTime(this.masterVolume * volMod, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    play(soundType) {
        if (!this.enabled) return;
        this.init();

        switch (soundType) {
            case 'hover':
                // Clique macio e metálico de hover
                this.playTone(800, 'sine', 0.05, 0.2);
                break;
            case 'click':
                // Clique mecânico de confirmação
                this.playTone(1200, 'triangle', 0.05, 0.4);
                setTimeout(() => this.playTone(1800, 'sine', 0.05, 0.2), 20);
                break;
            case 'scan':
                // Zumbido grave de inicialização
                this.playTone(150, 'sawtooth', 0.4, 0.3);
                setTimeout(() => this.playTone(300, 'sine', 0.4, 0.1), 100);
                break;
            case 'success':
                // Bipe de sucesso (auditoria concluída)
                this.playTone(880, 'sine', 0.1, 0.5);
                setTimeout(() => this.playTone(1760, 'sine', 0.2, 0.4), 100);
                break;
            case 'error':
                // Bipe grave de falha
                this.playTone(300, 'sawtooth', 0.2, 0.5);
                setTimeout(() => this.playTone(250, 'square', 0.3, 0.4), 150);
                break;
            case 'keystroke':
                // Simulação de teclado hacker
                this.playTone(2000 + Math.random() * 500, 'square', 0.02, 0.05);
                break;
        }
    }
}

window.SoundEngine = new AudioEngine();

// Auto-inicializar no primeiro clique do usuário na tela
document.addEventListener('click', () => {
    window.SoundEngine.init();
}, { once: true });
