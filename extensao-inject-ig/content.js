console.log("🛡️ Extensão inject-IG ativada neste domínio.");

// Cria o container base no site hospedeiro
let container = document.getElementById('inject-ig-root');
if (!container) {
  container = document.createElement('div');
  container.id = 'inject-ig-root';
  document.body.appendChild(container);
}

// =====================================================================
// ⚙️ CONFIGURAÇÃO DE AMBIENTE (Escolha apenas UM e comente o outro)
// =====================================================================

// 🔴 OPÇÃO 1: MODO LOCAL (Desenvolvimento)
// Use isso quando rodar 'npm run dev' na sua máquina (Não funciona em sites com cadeado HTTPS)
/*
const scriptVite = document.createElement('script');
scriptVite.type = 'module';
scriptVite.src = 'http://localhost:5173/@vite/client';
document.head.appendChild(scriptVite);

const scriptPrincipal = document.createElement('script');
scriptPrincipal.type = 'module';
scriptPrincipal.src = 'http://localhost:5173/src/main.jsx';
document.body.appendChild(scriptPrincipal);
*/


// 🟢 OPÇÃO 2: MODO PRODUÇÃO (Online / HTTPS)
// Use isso para sites reais. Lembre-se de rodar 'npm run build' e hospedar a pasta 'dist' online.
// Troque o link abaixo pela URL real de onde você hospedou o arquivo .js gerado.

const scriptPrincipal = document.createElement('script');
scriptPrincipal.type = 'module';
scriptPrincipal.crossOrigin = "anonymous";
// 👇👇 COLOQUE SEU LINK ONLINE AQUI 👇👇
scriptPrincipal.src = 'https://portifolio-igor-mu.vercel.app//dist/assets/inject-ig-overlay-injector.js'; 
document.body.appendChild(scriptPrincipal);

// IMPORTANTE: Adicione também o CSS gerado no build para o visual funcionar no modo online!
const cssPrincipal = document.createElement('link');
cssPrincipal.rel = 'stylesheet';
cssPrincipal.crossOrigin = "anonymous";
// 👇👇 COLOQUE SEU LINK DO CSS AQUI 👇👇
cssPrincipal.href = 'https://portifolio-igor-mu.vercel.app//dist/assets/inject-ig-overlay-injector.css';
document.head.appendChild(cssPrincipal);


console.log("✅ Módulo de Auditoria injetado pelo Browser. Aguardando Ctrl+Shift+D.");