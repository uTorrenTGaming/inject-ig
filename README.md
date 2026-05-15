# 🛡️ Inject-IG | Advanced Security Runtime Auditor

<div align="center">
  <img src="./inject-ig-console/logo.svg" width="150" alt="Inject-IG Logo">
  <br>
  <p><i>The Next-Gen Enterprise-Grade Runtime Auditing & Telemetry Suite.</i></p>

  [![Version](https://img.shields.io/badge/version-1.0.0--SNAPSHOT-blue?style=for-the-badge)](https://github.com/)
  [![Java](https://img.shields.io/badge/Java-21-orange?style=for-the-badge&logo=java)](https://openjdk.org/)
  [![Node](https://img.shields.io/badge/Node-18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/License-ISC-red?style=for-the-badge)](https://opensource.org/licenses/ISC)
</div>

---

## 📖 Sobre o Projeto

O **Inject-IG** é uma ferramenta de auditoria de segurança de alto nível projetada para análise em tempo real de domínios autorizados. Ele combina um motor robusto em **Java Spring Boot** com uma interface dinâmica em **React** que é injetada diretamente no navegador através de uma **Extensão Chromium**.

Toda a gestão é feita por um console central em **Electron**, proporcionando uma experiência de usuário (UX) premium e técnica, inspirada nos mais modernos dashboards de "Dark Tech".

### 🚀 Principais Módulos

*   **Core Engine (Java 21):** O cérebro do sistema. Gerencia telemetria via WebSockets e processa heurísticas de segurança.
*   **Overlay UI (React + Vite):** A interface injetada no site host, permitindo monitoramento direto sem sair da aba.
*   **Browser Extension:** O vetor de injeção seguro que carrega o Overlay em domínios específicos.
*   **Inject-IG Console:** Dashboard desktop nativo para controle total e logs em tempo real.

---

## 🛠️ Requisitos do Sistema

Antes de começar, certifique-se de ter instalado:

1.  **Java JDK 21** ou superior (Recomendado: [Amazon Corretto](https://aws.amazon.com/corretto/)).
2.  **Node.js 18.x** ou superior (LTS recomendada).
3.  **Git** (para clonar o repositório).
4.  **Google Chrome** ou qualquer navegador baseado em **Chromium** (Edge, Brave, etc).

---

## 📦 Tutorial de Instalação (Passo a Passo)

Siga estas etapas exatamente como descrito para evitar erros.

### 1. Preparação do Ambiente
Abra seu terminal e navegue até a pasta onde deseja salvar o projeto:

```bash
# Clone o repositório (substitua pelo seu link se necessário)
# git clone https://github.com/uTorrenTGaming/inject-ig.git
# cd inject-ig
```

### 2. Executando o Setup Automatizado
O projeto conta com um script de setup inteligente que gera a estrutura necessária e valida o ambiente.

```bash
# Dê permissão de execução ao script
chmod +x setup.sh

# Execute o setup
./setup.sh
```
*Este comando criará todas as pastas e arquivos fonte base dentro de `inject-ig-engine`.*

### 3. Instalando Dependências do Console
Navegue até a pasta do console central e instale os pacotes:

```bash
cd inject-ig-console
npm install
cd ..
```

### 4. Instalando Dependências do Overlay
Navegue até a pasta do frontend injetável e instale os pacotes:

```bash
cd inject-ig-engine/overlay-ui
npm install
cd ../..
```

---

## 🚀 Como Executar o Projeto

Agora que tudo está instalado, vamos colocar o motor para rodar.

### Método Rápido (Recomendado)
Use o script unificado para subir o Backend e o Console simultaneamente:

```bash
# Na raiz do projeto
chmod +x iniciar
./iniciar inject-ig
```

O que este script faz:
1.  Limpa instâncias antigas na porta `8080`.
2.  Inicia o **Core Engine (Java)** em background.
3.  Aguardará o motor ficar online (localhost:8080).
4.  Abrirá o **Inject-IG Console (Electron)**.

---

## 🧩 Configurando a Extensão do Navegador

Para que o overlay apareça nos sites, você precisa carregar a extensão no seu Chrome:

1.  Abra o navegador e digite `chrome://extensions/` na barra de endereços.
2.  Ative o **Modo do Desenvolvedor** (canto superior direito).
3.  Clique em **Carregar sem compactação** (Load Unpacked).
4.  Selecione a pasta: `inject-ig-engine/browser-extension`.
5.  A extensão aparecerá na sua lista.

---

## ⌨️ Comandos e Atalhos

Uma vez que a extensão esteja ativa e o projeto rodando:

| Ação | Comando/Atalho |
| :--- | :--- |
| **Ativar Overlay na Página** | `Ctrl + Shift + D` |
| **Fechar Overlay** | Clique no `✕` ou repita o atalho |
| **Abrir Console Central** | `./iniciar inject-ig` |
| **Build do Overlay** | `npm run build` (dentro de overlay-ui) |

---

## 🔍 Solução de Problemas (Troubleshooting)

*   **Porta 8080 em uso:** O script `iniciar` tenta matar processos antigos, mas se falhar, use `fuser -k 8080/tcp` (Linux/Mac) ou finalize o processo Java no Gerenciador de Tarefas (Windows).
*   **Erro de Versão de Java:** Verifique com `java -version`. Você **precisa** do JDK 21.
*   **Overlay não aparece:** Verifique se o domínio atual está listado no `manifest.json` da extensão em `host_permissions`. Por padrão, ele aceita `localhost` e `*.seudominio.com`.

---

## ⚖️ Aviso Legal (Disclaimer)

Esta ferramenta foi desenvolvida exclusivamente para fins educacionais e de auditoria de segurança **autorizada**. O uso deste software para acessar ou analisar sistemas sem permissão explícita é ilegal e antiético. Os desenvolvedores não se responsabilizam pelo uso indevido desta ferramenta.

---

<div align="center">
  <p>Feito com ⚡ Igor</p>
</div>
