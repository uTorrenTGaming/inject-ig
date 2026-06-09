import React from 'react';
import { motion } from 'framer-motion';

export default function HeroAsymmetric({ onOpenModal }) {
  return (
    <section className="min-h-[100dvh] w-full pt-32 pb-16 px-6 md:px-12 flex flex-col items-center justify-center">
      <div className="max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        
        {/* Left Aligned Content */}
        <div className="flex flex-col items-start justify-center text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-muted text-sm font-mono tracking-widest uppercase mb-6 block">
              Inject-IG Runtime Environment
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] text-balance mb-8 text-white">
              Vigilância furtiva.<br/>
              Acesso irrestrito.
            </h1>
            <p className="text-muted text-lg md:text-xl max-w-[50ch] text-balance leading-relaxed mb-12">
              Arquitetura de intrusão construída para evasão avançada de EDR e telemetria de precisão em anel 0.
            </p>
            
            <div className="flex flex-wrap items-center gap-6">
              <button 
                onClick={onOpenModal}
                className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:scale-[0.98] transition-transform shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] active:scale-95"
              >
                Obter Licença
              </button>
              <div className="text-sm font-semibold tracking-wide text-muted">
                V. 2.0.0
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Aligned Asset (Dashboard Mockup) */}
        <motion.div 
          className="relative w-full h-[50vh] lg:h-[70vh] rounded-[2.5rem] border border-white/10 bg-surface shadow-diffusion overflow-hidden p-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          {/* Inner window */}
          <div className="w-full h-full rounded-[2rem] overflow-hidden relative">
            <img 
              src="/assets/img/screen_2.png" 
              alt="Dashboard Preview" 
              className="absolute inset-0 w-full h-full object-contain object-center"
            />
            {/* Minimal gradient mask at bottom so we don't hide the interface */}
            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
          </div>
        </motion.div>

      </div>
    </section>
  );
}
