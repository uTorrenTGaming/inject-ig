import React, { useEffect } from 'react';
import Lenis from 'lenis';
import HeroAsymmetric from './components/HeroAsymmetric';
import BentoEngine from './components/BentoEngine';
import GalleryHorizontal from './components/GalleryHorizontal';
import DownloadSection from './components/DownloadSection';
import IGIcon from './components/IGIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Lenis Smooth Scroll Setup
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Apple-like easing
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      smoothTouch: false,
      touchMultiplier: 2,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="bg-background text-primary selection:bg-white/20">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-6 py-6 mix-blend-difference">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 font-bold text-lg tracking-tight text-white">
            <IGIcon size={28} /> Inject-IG
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-6 py-2 rounded-full font-semibold text-sm hover:scale-[0.98] transition-transform active:scale-95"
          >
            Comprar
          </button>
        </div>
      </nav>

      <main>
        <HeroAsymmetric onOpenModal={() => setIsModalOpen(true)} />
        
        <GalleryHorizontal />

        <BentoEngine />

        {/* Pricing & Footer Section */}
        <section className="py-32 px-6 md:px-12 bg-surface border-t border-white/5">
          <div className="max-w-[1400px] mx-auto">
            
            <div className="text-center mb-24 max-w-2xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6 text-balance">
                Licenciamento Furtivo.
              </h2>
              <p className="text-muted text-lg text-balance">
                Pagamento via cripto ou Mercado Pago com liberação automática de chave de licença no terminal.
              </p>
            </div>
             
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mb-32">
                <div className="rounded-[2rem] border border-white/10 bg-background p-10 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">1 Dia</h3>
                    <p className="text-muted text-sm mb-6">Acesso total por 24 horas.</p>
                    <div className="tabular-nums text-5xl font-bold mb-8">R$ 19<span className="text-2xl text-muted">,90</span></div>
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className="w-full bg-white/10 text-white px-6 py-4 rounded-full font-semibold hover:bg-white/20 transition-colors">Assinar Diário</button>
                </div>

                <div className="rounded-[2rem] border border-white/20 bg-surface shadow-diffusion p-10 flex flex-col justify-between relative scale-100 md:scale-105 z-10">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                    Recomendado
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">30 Dias</h3>
                    <p className="text-muted text-sm mb-6">Operações estendidas mensais.</p>
                    <div className="tabular-nums text-5xl font-bold mb-8 text-white">R$ 99<span className="text-2xl text-muted">,90</span></div>
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className="w-full bg-white text-black px-6 py-4 rounded-full font-semibold hover:scale-[0.98] transition-transform">Assinar Mensal</button>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-background p-10 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">90 Dias</h3>
                    <p className="text-muted text-sm mb-6">Infraestrutura para campanhas longas.</p>
                    <div className="tabular-nums text-5xl font-bold mb-8">R$ 199<span className="text-2xl text-muted">,90</span></div>
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className="w-full bg-white/10 text-white px-6 py-4 rounded-full font-semibold hover:bg-white/20 transition-colors">Assinar Trimestral</button>
                </div>
            </div>

            <DownloadSection />

          </div>
        </section>

      </main>

      {/* Purchase Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            
            {/* Backdrop Blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full max-w-lg bg-surface border border-white/10 p-10 rounded-[2.5rem] shadow-[0_0_100px_rgba(255,255,255,0.05)] text-center flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <IGIcon size={32} className="text-white" />
              </div>
              
              <h3 className="text-3xl font-bold tracking-tight text-white mb-4">
                Ativação via Console
              </h3>
              
              <p className="text-muted text-lg leading-relaxed text-balance mb-8">
                Para garantir a total segurança e anonimato da transação, as licenças do Inject-IG são adquiridas <strong>exclusivamente por dentro do software</strong>.
              </p>

              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }}
                className="w-full bg-white text-black px-6 py-4 rounded-full font-bold hover:scale-[0.98] transition-transform active:scale-95"
              >
                Baixar o Console Agora
              </button>
              
              <button 
                onClick={() => setIsModalOpen(false)}
                className="mt-6 text-sm text-muted hover:text-white transition-colors"
              >
                Cancelar
              </button>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
