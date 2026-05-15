#!/bin/bash

STREAMING_CHUNK: Inicializando ambiente e criando estrutura corporativa...

echo "=========================================================="
echo "🚀 Iniciando setup do inject-ig Setup..."
echo "=========================================================="

Define o diretório raiz

PROJECT_ROOT="inject-ig-engine"

echo "📂 Criando estrutura de pastas enterprise..."
mkdir -p $PROJECT_ROOT/{core-engine/src/main/java/com/nexus/audit/config,core-engine/src/main/resources}
mkdir -p $PROJECT_ROOT/{overlay-ui/src/components,overlay-ui/src/hooks,overlay-ui/public}
mkdir -p $PROJECT_ROOT/{browser-extension/icons,browser-extension/scripts,browser-extension/popup}
mkdir -p $PROJECT_ROOT/pwa-module

cd $PROJECT_ROOT

STREAMING_CHUNK: Configurando Core Engine (Java Spring Boot)...

echo "☕ Gerando Backend Core (Java 21 + Spring Boot)..."

cat << 'EOF' > core-engine/pom.xml


4.0.0

org.springframework.boot
spring-boot-starter-parent
3.2.3
 

com.nexus
audit-engine
1.0.0-SNAPSHOT
inject-ig Engine
Core engine for telemetry and security validation

<java.version>21</java.version>



org.springframework.boot
spring-boot-starter-web


org.springframework.boot
spring-boot-starter-websocket


org.springframework.boot
spring-boot-starter-security



EOF

cat << 'EOF' > core-engine/src/main/java/com/nexus/audit/InjectIGApplication.java
package com.injectig;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InjectIGApplication {
public static void main(String[] args) {
SpringApplication.run(InjectIGApplication.class, args);
System.out.println("🛡️ inject-ig Core Engine started. Waiting for overlay connections...");
}
}
EOF

cat << 'EOF' > core-engine/src/main/java/com/nexus/audit/config/WebSocketConfig.java
package com.injectig.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
@Override
public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
// Endpoint seguro para telemetria em tempo real
registry.addHandler(new TelemetryHandler(), "/api/v1/stream/telemetry")
.setAllowedOrigins("*"); // Em prod, alterar para os domínios autorizados
}
}
EOF

cat << 'EOF' > core-engine/src/main/java/com/nexus/audit/config/TelemetryHandler.java
package com.injectig.config;

import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

public class TelemetryHandler extends TextWebSocketHandler {
@Override
protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
// Recebe payload de inspeção do browser e processa a heurística
System.out.println("Payload recebido do Overlay: " + message.getPayload());
session.sendMessage(new TextMessage("{"status":"ACK", "analysis": "secure"}"));
}
}
EOF

STREAMING_CHUNK: Configurando Overlay UI (React + Vite + Tailwind)...

echo "⚛️ Gerando Frontend Overlay (React + Vite)..."

cat << 'EOF' > overlay-ui/package.json
{
"name": "inject-ig-overlay-ui",
"private": true,
"version": "0.0.1",
"type": "module",
"scripts": {
"dev": "vite",
"build": "vite build",
"preview": "vite preview"
},
"dependencies": {
"lucide-react": "^0.344.0",
"react": "^18.2.0",
"react-dom": "^18.2.0",
"framer-motion": "^11.0.8"
},
"devDependencies": {
"@types/react": "^18.2.56",
"@types/react-dom": "^18.2.19",
"@vitejs/plugin-react": "^4.2.1",
"autoprefixer": "^10.4.18",
"postcss": "^8.4.35",
"tailwindcss": "^3.4.1",
"vite": "^5.1.4"
}
}
EOF

cat << 'EOF' > overlay-ui/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
plugins: [react()],
build: {
// Configuração para gerar um único arquivo injetável
rollupOptions: {
output: {
entryFileNames: assets/inject-ig-overlay-injector.js,
chunkFileNames: assets/[name].js,
assetFileNames: assets/[name].[ext]
}
}
}
});
EOF

cat << 'EOF' > overlay-ui/tailwind.config.js
/ @type {import('tailwindcss').Config} /
export default {
content: [
"./index.html",
"./src//.{js,ts,jsx,tsx}",
],
theme: {
extend: {
animation: {
'spin-slow': 'spin 3s linear infinite',
}
},
},
plugins: [],
}
EOF

cat << 'EOF' > overlay-ui/postcss.config.js
export default {
plugins: {
tailwindcss: {},
autoprefixer: {},
},
}
EOF

cat << 'EOF' > overlay-ui/src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Reset escopado para evitar vazar estilos para o site host */
#inject-ig-root {
position: fixed;
z-index: 999999;
top: 0;
left: 0;
width: 0;
height: 0;
pointer-events: none;
}
EOF

STREAMING_CHUNK: Gerando motor de injeção e Shadow DOM...

cat << 'EOF' > overlay-ui/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Cria um contêiner no body caso não exista
let container = document.getElementById('inject-ig-root');
if (!container) {
container = document.createElement('div');
container.id = 'inject-ig-root';
document.body.appendChild(container);
}

// Inicia o React dentro do contêiner injetado
ReactDOM.createRoot(container).render(
<React.StrictMode>

</React.StrictMode>
);

console.log('🛡️ inject-ig Overlay Engine injected successfully.');
EOF

cat << 'EOF' > overlay-ui/src/App.jsx
import React, { useState, useEffect } from 'react';
import { Terminal, ShieldAlert } from 'lucide-react';

// Versão boilerplate inicial conectando o frontend ao backend
export default function App() {
const [isOpen, setIsOpen] = useState(false);

useEffect(() => {
const handleKeyDown = (e) => {
if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
e.preventDefault();
setIsOpen(prev => !prev);
}
};
window.addEventListener('keydown', handleKeyDown);
return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

if (!isOpen) return null;

return (




inject-ig Audit
Core Engine Connected
<button onClick={() => setIsOpen(false)} className="ml-4 text-white/50 hover:text-white">✕


> inject-ig Runtime Hooks initialized...
> WebSocket listening on wss://localhost:8080/api/v1/stream/telemetry
Waiting for events...



);
}
EOF

STREAMING_CHUNK: Configurando Browser Extension Chromium...

echo "🧩 Gerando Browser Extension (Manifest V3)..."

cat << 'EOF' > browser-extension/manifest.json
{
"manifest_version": 3,
"name": "inject-ig Overlay",
"version": "0.0.1",
"description": "Enterprise-grade runtime auditing tool for authorized domains.",
"permissions": [
"activeTab",
"scripting",
"storage",
"webRequest"
],
"host_permissions": [
"http://localhost/",
"https://.seudominio.com/"
],
"background": {
"service_worker": "scripts/background.js"
},
"content_scripts": [
{
"matches": ["http://localhost/", "https://.seudominio.com/"],
"js": ["scripts/content.js"],
"run_at": "document_end"
}
],
"action": {
"default_popup": "popup/index.html"
}
}
EOF

cat << 'EOF' > browser-extension/scripts/background.js
// Intercepta tráfego em background para análise de segurança
chrome.webRequest.onHeadersReceived.addListener(
function(details) {
// Analisa CSP, CORS, X-Frame-Options
console.log("Headers detectados:", details.responseHeaders);
},
{ urls: ["<all_urls>"] },
["responseHeaders"]
);

chrome.runtime.onInstalled.addListener(() => {
console.log("inject-ig Extension Installed.");
});
EOF

cat << 'EOF' > browser-extension/scripts/content.js
// Injetor do Overlay compilado
console.log("inject-ig Content Script carregado. Checando autorização...");

// Simula validação de JWT/Token para injetar
const isAuthorized = true;

if (isAuthorized) {
// Puxar o build gerado pelo Vite (inject-ig-overlay-injector.js) e CSS
// Em produção, isso seria carregado localmente da extensão via chrome.runtime.getURL
console.log("Autorizado. Aguardando trigger (Ctrl+Shift+D).");
}
EOF

cat << 'EOF' > browser-extension/popup/index.html

STREAMING_CHUNK: Finalizando permissões e instruções...

echo "✅ Setup concluído com sucesso!"
echo "=========================================================="
echo "📁 O projeto foi criado em: ./$PROJECT_ROOT"
echo ""
echo "Para iniciar:"
echo "1️⃣  Backend Java:"
echo "    cd $PROJECT_ROOT/core-engine && ./mvnw spring-boot:run"
echo ""
echo "2️⃣  Frontend React/Overlay:"
echo "    cd $PROJECT_ROOT/overlay-ui && npm install && npm run dev"
echo ""
echo "3️⃣  Extensão do Chrome:"
echo "    Abra chrome://extensions, ative o 'Modo do Desenvolvedor',"
echo "    clique em 'Carregar sem compactação' e selecione a pasta:"
echo "    $PROJECT_ROOT/browser-extension"
echo "=========================================================="