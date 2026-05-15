# 🛡️ Tutorial Completo: Inject-IG Security Hub

Bem-vindo ao **Inject-IG**, um hub profissional de auditoria de segurança e OSINT. Este guia detalha como configurar, instalar e operar o ecossistema completo.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

1.  **Node.js (v18+)**: Necessário para o Dashboard Electron.
2.  **Java JDK 17 ou 21**: Necessário para o Core Engine (Backend).
3.  **Maven**: Para gerenciar as dependências do Java (o projeto inclui o `./mvnw` para facilitar).
4.  **Git**: Para clonar o repositório.

---

## 🚀 Passo a Passo de Instalação

### 1. Preparando o Dashboard (Console)
O dashboard é a interface principal baseada em Electron.

```bash
cd inject-ig-console
npm install
```

### 2. Preparando o Core Engine (Backend)
O backend processa os scans e gerencia a telemetria.

```bash
cd inject-ig-engine/core-engine
chmod +x mvnw
./mvnw clean install
```

---

## 🚦 Como Rodar o Projeto

A maneira mais fácil de rodar é usando o script unificado na raiz:

### Método Automático
Na pasta raiz do projeto, execute:
```bash
./iniciar inject-ig
```
Este comando irá:
1. Iniciar o **Core Engine** Java em segundo plano (`localhost:8080`).
2. Abrir o **Dashboard Electron** automaticamente.

### Método Manual
Se preferir rodar separadamente:

**Terminal 1 (Backend):**
```bash
cd inject-ig-engine/core-engine
./mvnw spring-boot:run
```

**Terminal 2 (Frontend/Console):**
```bash
cd inject-ig-console
npm start
```

---

## 🛠️ Funcionalidades do Dashboard

### 1. Terminal Interativo
Use o terminal embutido para executar comandos rápidos:
- `ajuda`: Lista comandos disponíveis.
- `limpar`: Limpa a tela do terminal.
- `core`: Inicia o backend manualmente se necessário.

### 2. Cofre (Vault)
Aqui você realiza as varreduras online:
- Insira o URL do alvo (ex: `https://google.com`).
- Clique em **Varredura Online**.
- Acompanhe o progresso em tempo real e veja os dados sendo extraídos em cards.

### 3. Gerenciador de Arquivos
Todos os dados extraídos (emails, endpoints, vulnerabilidades) são listados aqui. Você pode baixar cada item individualmente como um arquivo `.txt`.

### 4. Ferramentas (Tools)
Uma biblioteca com 50+ utilitários de OSINT e Segurança. Basta selecionar uma ferramenta e clicar em **Executar**.

### 5. Relatórios
Gere relatórios profissionais em **PDF**, **JSON** ou **CSV** baseados nos dados coletados na sessão atual.

---

## 🔧 Solução de Problemas

**Erro: "Core Engine offline"**
- Certifique-se de que nada está usando a porta `8080`.
- Verifique o arquivo `core-engine.log` na raiz para ver erros do Java.

**Erro: "npm install" falhou**
- Tente `npm install --legacy-peer-deps`.
- Verifique se sua versão do Node.js é compatível.

---

## 🔐 Aviso Legal
Este projeto foi desenvolvido para fins de **auditoria de segurança ética** e **educação**. O uso destas ferramentas contra sistemas sem autorização explícita é ilegal.
