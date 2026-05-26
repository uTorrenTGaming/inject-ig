# Inject-IG: Sistema Electron + HWID

O **inject-ig** é um ecossistema de software empacotado em **Electron** com design "Liquid Glass", focado em controle de acesso seguro utilizando Hardwares físicos (Placa-mãe).

Todo o motor legado em Java e as lógicas em console solto foram DELETADAS e migradas nativamente para Node.js, comunicando de modo assíncrono e ultra veloz com um banco de dados PostgreSQL.

## 🌟 Arquitetura Central (PostgreSQL)

O banco de dados é a alma do sistema. Você precisa ter um projeto Supabase configurado e rodando.

### Configuração do Banco (Supabase)
As credenciais e URLs de acesso não devem ser expostas. O sistema utiliza um arquivo `.env` para carregar as informações do banco de dados com segurança.
Crie um arquivo `.env` na pasta `inject-ig-console` baseado no modelo `.env.example`:
```
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_KEY="sua_chave_secreta_aqui"
```

As autenticações ocorrem de forma passiva: O Electron detecta o hash do seu Hardware (macOS, Windows ou Linux) usando `node-machine-id` e valida a licença e status (banimento) em tempo real contra o Supabase. Se estiver banido, uma tela vermelha intrusiva bloqueará a interface e os comandos de navegação.

## 🛠 Como iniciar em modo Dev

Basta possuir o Node.js v18+.
O antigo script Bash (iniciar) foi simplificado para simplesmente acionar o npm.

```bash
# Na pasta raiz
cd inject-ig-console

# Instale os pacotes Node.js necessários (Apenas na primeira vez)
npm install

# Rode o ambiente
npm run dev
```

## 📦 Como gerar os Instaladores (.exe, .dmg, .AppImage)

O aplicativo está pronto para envio final usando o `electron-builder`. Basta executar os seguintes scripts na pasta `/inject-ig-console`:

- Para **MacOS** (.dmg e .app): `npm run dist:mac`
- Para **Windows** (.exe): `npm run dist:win`
- Para **Linux** (.AppImage e snap): `npm run dist:linux`

> Para ler guias completos de como funcionam as tabelas e o design da interface, consulte a documentação profunda na pasta `/Tutorial-completo`.
