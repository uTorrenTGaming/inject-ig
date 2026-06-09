import React from 'react';
import { motion } from 'framer-motion';

const bentoItems = [
  {
    id: 1,
    title: 'Painel Central de Operações',
    description: 'Monitoramento contínuo do nível de privilégio, radar de saúde da rede local e ações rápidas sem detecção.',
    image: '/assets/img/screen_6.png',
    colSpan: 'lg:col-span-8',
  },
  {
    id: 2,
    title: 'Arsenal OSINT',
    description: 'Acesso instantâneo a ferramentas de auditoria: Shodan Scan, Whois Lookup, Dorks e extração de e-mails.',
    image: '/assets/img/screen_10.png',
    colSpan: 'lg:col-span-4',
  },
  {
    id: 3,
    title: 'Injeção de Interface',
    description: 'Inserção automática do overlay furtivo em projetos web e controle direto do Core Engine Java.',
    image: '/assets/img/screen_8.png',
    colSpan: 'lg:col-span-4',
  },
  {
    id: 4,
    title: 'Terminal Nativo',
    description: 'Acompanhamento seguro de logs do sistema e telemetria de intrusão em tempo real sem alertar EDRs.',
    image: '/assets/img/screen_7.png',
    colSpan: 'lg:col-span-8',
  }
];

export default function BentoEngine() {
  return (
    <section className="py-32 px-6 md:px-12 w-full bg-background border-t border-white/5">
      <div className="max-w-[1400px] mx-auto">
        
        <div className="mb-20">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
            Arquitetura de Precisão.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-16">
          {bentoItems.map((item, index) => (
            <motion.div 
              key={item.id}
              className={`flex flex-col gap-6 ${item.colSpan}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-full h-[400px] rounded-[2.5rem] border border-white/10 bg-surface shadow-diffusion overflow-hidden p-2 group relative">
                <div className="w-full h-full rounded-[2rem] overflow-hidden relative bg-surface flex items-center justify-center p-4">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Glass reflection overlay */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                </div>
              </div>

              {/* Outside Text */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-muted text-base leading-relaxed text-balance">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
