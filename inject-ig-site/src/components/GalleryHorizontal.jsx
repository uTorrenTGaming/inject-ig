import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const screenshots = Array.from({ length: 21 }, (_, i) => `/assets/img/screen_${i + 1}.png`)
  .filter(src => !src.includes('screen_1.png'));

export default function GalleryHorizontal() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;

    const getScrollAmount = () => {
      let trackWidth = track.scrollWidth;
      return -(trackWidth - window.innerWidth + 200); // 200px offset for padding
    };

    const tween = gsap.to(track, {
      x: getScrollAmount,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${getScrollAmount() * -1}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true
      }
    });

    return () => {
      tween.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section ref={sectionRef} className="h-screen w-full bg-background flex flex-col justify-center overflow-hidden border-t border-white/5">
      
      <div className="px-6 md:px-12 mb-12 shrink-0">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white">
          Visualização em Tempo Real.
        </h2>
        <p className="text-muted mt-4 max-w-[60ch] text-balance">
          Controle absoluto da interface remota. Do explorador de arquivos ao keylogger imperceptível.
        </p>
      </div>

      <div ref={trackRef} className="flex gap-8 px-6 md:px-12 pb-12 w-max">
        {screenshots.map((src, idx) => (
          <div 
            key={idx} 
            className="w-[80vw] max-w-[800px] aspect-[16/10] shrink-0 rounded-[2rem] border border-white/10 bg-surface shadow-diffusion overflow-hidden p-2"
          >
            <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-surface flex items-center justify-center">
              <img 
                src={src} 
                alt={`Tela ${idx + 1}`} 
                className="w-full h-full object-contain p-2"
                loading={idx > 2 ? "lazy" : "eager"}
              />
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
