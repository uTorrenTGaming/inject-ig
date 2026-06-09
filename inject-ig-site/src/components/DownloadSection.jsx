import React, { useEffect, useState } from 'react';
import IGIcon from './IGIcon';

export default function DownloadSection() {
  const [downloads, setDownloads] = useState({
    win: null,
    mac: null,
    linux: null,
    version: 'Carregando...',
  });

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        const response = await fetch('https://api.github.com/repos/uTorrenTGaming/inject-ig/releases/latest');
        const data = await response.json();
        
        if (data && data.assets) {
          let winLink = null;
          let macLink = null;
          let linuxLink = null;

          data.assets.forEach(asset => {
            if (asset.name.endsWith('.exe')) winLink = asset.browser_download_url;
            if (asset.name.endsWith('.dmg')) macLink = asset.browser_download_url;
            if (asset.name.endsWith('.AppImage')) linuxLink = asset.browser_download_url;
          });

          setDownloads({
            win: winLink || data.html_url,
            mac: macLink || data.html_url,
            linux: linuxLink || data.html_url,
            version: data.tag_name || 'Latest',
          });
        }
      } catch (error) {
        console.error('Erro ao buscar a última versão no GitHub:', error);
        setDownloads(prev => ({ ...prev, version: 'Indisponível' }));
      }
    }

    fetchLatestRelease();
  }, []);

  return (
    <div className="border-t border-white/5 pt-32 pb-20 mt-20">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-4 text-balance">
          Download do Console
        </h2>
        <p className="text-muted text-lg text-balance">
          Baixe a versão mais recente ({downloads.version}) diretamente dos servidores seguros do GitHub.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        
        {/* Windows */}
        <a 
          href={downloads.win || '#'} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-8 rounded-[2rem] border border-white/10 bg-surface hover:bg-white/5 transition-colors w-full sm:w-64 group"
        >
          <IGIcon size={48} className="text-white mb-6 opacity-70 group-hover:opacity-100 transition-opacity" />
          <span className="font-bold text-xl text-white mb-2">Windows</span>
          <span className="text-sm text-muted">.exe (64-bit)</span>
        </a>

        {/* macOS */}
        <a 
          href={downloads.mac || '#'} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-8 rounded-[2rem] border border-white/10 bg-surface hover:bg-white/5 transition-colors w-full sm:w-64 group"
        >
          <IGIcon size={48} className="text-white mb-6 opacity-70 group-hover:opacity-100 transition-opacity" />
          <span className="font-bold text-xl text-white mb-2">macOS</span>
          <span className="text-sm text-muted">.dmg (Intel/Silicon)</span>
        </a>

        {/* Linux */}
        <a 
          href={downloads.linux || '#'} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-8 rounded-[2rem] border border-white/10 bg-surface hover:bg-white/5 transition-colors w-full sm:w-64 group"
        >
          <IGIcon size={48} className="text-white mb-6 opacity-70 group-hover:opacity-100 transition-opacity" />
          <span className="font-bold text-xl text-white mb-2">Linux</span>
          <span className="text-sm text-muted">.AppImage (Deb/RPM)</span>
        </a>

      </div>
    </div>
  );
}
