import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Cria um contêiner no body caso não exista com o ID Stealth
let container = document.getElementById('inject-ig-root');
if (!container) {
  container = document.createElement('div');
  container.id = 'inject-ig-root';
  document.body.appendChild(container);
}

// Inicia o React dentro do contêiner injetado
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// O log foi removido para ser totalmente silencioso (Stealth mode)