# Painel Administrativo (Roadmap)

Toda a infraestrutura atual foi pensada para segregar o controle administrativo num ambiente totalmente isolado e seguro. O conceito é termos **dois softwares distintos**.

## 1. O App Cliente (Este repositório)
Permite acesso apenas se a máquina for validada no banco de dados. Toda a lógica de controle administrativo foi removida de seu código-fonte para impedir acesso indevido.

## 2. O App Administrador (A ser criado)
Será um novo aplicativo Electron separado (outro repositório), projetado exclusivamente para gestão interna.
Ele será o "Painel de Controle" que vai:
- Ler os dados do banco de dados.
- Alterar instantaneamente o status de acesso dos usuários (aplicando bloqueios por hardware ID).
- Permitir edição de perfis, logs e auditorias.
- Controlar o acesso de máquinas em tempo real.

Como o banco de dados é central, qualquer alteração disparada pelo *App Administrador* será imediatamente aplicada nos *Apps Clientes* conectados.

