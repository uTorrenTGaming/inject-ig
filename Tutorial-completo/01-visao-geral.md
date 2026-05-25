# Visão Geral da Arquitetura HWID + Electron

Bem-vindo ao novo ecossistema do aplicativo. Toda a estrutura antiga baseada em um servidor de console Java e injetores em HTML soltos foi descontinuada. Adotamos um formato **Premium e Independente**, transformando o software num **App Nativo**.

## 🚀 Como Funciona Agora?

1. **Frontend 100% Electron**: Toda a interface gráfica, de monitoramento e de ferramentas foi empacotada em uma aplicação desktop executável (Mac, Linux e Windows). A interface foi polida para oferecer uma experiência "Liquid Glass" com fluidez nativa.
2. **PostgreSQL Direto**: Em vez de passar por um servidor intermediário (Backend API), o Electron conecta diretamente a uma instância PostgreSQL hiper veloz.
3. **Autenticação por HWID (Hardware ID)**: Esqueça logins e senhas tradicionais. A identidade do usuário agora é atrelada fisicamente à placa-mãe. Assim que o app abre, ele gera um hash SHA-256 único do PC (usando `node-machine-id`). Se esse hash existir no banco de dados e não estiver banido, o login é automático e sem telas.

## 📦 Vantagens da Nova Abordagem

> [!TIP]
> **Anti-Cheat e Segurança Máxima**: Administradores podem banir computadores fisicamente do banco de dados, bloqueando o acesso independente da conta do usuário.

> [!IMPORTANT]  
> **Sem Dependências**: Não é preciso mais rodar o Java Runtime nem manter portas abertas no terminal. O app é independente e abre em menos de 1 segundo.

> [!NOTE]
> **Compatibilidade Multiplataforma**: Ao ser empacotado, o projeto gera instaladores oficiais (`.exe`, `.dmg`, `.AppImage`) fáceis de distribuir e gerenciar.

---
**Próximo Passo:** Entenda a estrutura de dados no guia `02-banco-de-dados.md`.
