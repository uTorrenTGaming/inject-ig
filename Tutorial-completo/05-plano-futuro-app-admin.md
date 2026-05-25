# App Administrador Oculto (Roadmap)

Toda a infraestrutura atual foi pensada para blindar a base de clientes do aplicativo principal e isolar o controle administrativo num ambiente totalmente segregado e seguro. O conceito é termos **dois softwares diferentes**.

## 1. O App Cliente (Este repositório)
Apenas permite acesso se a máquina for validada no PostgreSQL e não permite NENHUMA modificação do sistema de segurança através dele. Toda a lógica de controle (`/api/auth/admin`) foi DELETADA de seu código-fonte para impedir engenharia reversa.

## 2. O App Administrador (A ser criado)
Será um novo aplicativo Electron separado (outro repositório ou pasta oculta), projetado exclusivamente para você.
Ele será o "Painel de Controle" que vai:
- Ler os dados do PostgreSQL.
- Alterar instantaneamente a coluna `is_banned` de usuários-alvo (Aplicando Hard-Bans via Placa-Mãe na mesma hora).
- Permitir edição de avatares, logs e auditorias.
- Bloquear computadores à força apertando um botão.

Como o banco de dados é um PostgreSQL central, qualquer "UPDATE" disparado pelo *App Administrador* será imediatamente sentido pelos *Apps Clientes* conectados!
