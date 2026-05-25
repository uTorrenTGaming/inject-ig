# Autenticação, Interface e Segurança (Anti-Cheat)

Uma das maiores inovações arquiteturais do sistema é o fim das contas de usuário convencionais. A segurança física das máquinas-cliente é a prioridade.

## 1. O Identificador de Hardware (HWID)

Através do pacote `node-machine-id`, o Electron expõe a função de identificação no backend Node.js, e ela é injetada com segurança pela Ponte IPC (`preload.js`) para a interface visual.

O HWID lê e criptografa as características físicas imutáveis do computador:
- No macOS: O UUID serial do dispositivo.
- No Windows: O `MachineGuid` no Registry.
- No Linux: O `/var/lib/dbus/machine-id`.

Isso garante que um banimento aplique-se **diretamente à máquina física**, imune a formatações rápidas, limpezas de disco, VPNs ou reinstalações do software.

## 2. A UX de Login

Quando um cliente roda o app, o fluxo `renderer.js` faz as seguintes etapas:
1. **Verificação Silenciosa**: Interpela o PostgreSQL via IPC. "Esse HWID existe?"
2. **Auto-Login**: Se o HWID for conhecido e `is_banned` for falso, o sistema pula todas as telas de autenticação e injeta o usuário diretamente no painel principal do Terminal. A latência é menor que 1 segundo.
3. **Bloqueio (Banned View)**: Se `is_banned` for verdadeiro, o sistema carrega a tela `view-banned`. Todos os comandos de navegação são destruídos, e a tela trava em vermelho permanente informando bloqueio de hardware.
4. **Primeiro Acesso (Setup View)**: Caso o banco de dados desconheça a máquina, apenas pede um "Nome" e uma "Foto". Não há campo de senha. Uma vez salvo, esse perfil estará acorrentado para sempre ao computador local.

## 3. Aesthetics & Design

A interface foi refinada e padronizada utilizando "Liquid Glass", com:
- `backdrop-filter` para emular o desfoque opaco do macOS.
- Remoção do "titlebar" feio via HTML antigo e integração aos botões nativos do Sistema Operacional (`titleBarStyle: 'hiddenInset'`).
- Micro-animações suaves para dar a sensação de software corporativo de ponta.
