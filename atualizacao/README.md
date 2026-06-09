# 🚀 Tutorial: Atualização Automática (Deploy)

Esta pasta contém a ferramenta oficial de deploy automático do **Inject-IG**.
Ela foi projetada para compilar, assinar, mapear e publicar sua atualização para Windows, Mac e Linux sem que você precise tocar em nada.

## 🛠️ Como utilizar?

Toda vez que você terminar de mexer no código do aplicativo (alterar o design em HTML, mexer nas funções em JS, etc) e quiser enviar essa nova versão para os clientes/vítimas, siga estes 2 passos:

### Passo 1: Abra o Terminal
Abra um terminal (prompt de comando) e navegue até esta pasta `atualizacao`:
```bash
cd /Users/igorgomes/Downloads/Seguranca/atualizacao
```

### Passo 2: Rode o "Botão Vermelho"
Digite o comando abaixo e aperte ENTER:
```bash
./publicar_atualizacao.sh
```

## ✨ O que o script faz por trás dos panos?
Assim que você roda o comando, você pode ir pegar um café. O script se encarrega de:
1. **Aumentar a Versão:** Altera o código de `v2.0.1` para `v2.0.2` (patch automático).
2. **Commit no GitHub:** Salva todos os arquivos que você mexeu e joga pro seu repositório.
3. **Limpeza do Mac:** Previne e limpa aquele famoso bug do `hdiutil` que trava a compilação do `.dmg`.
4. **Modo Bypass:** Liga a variável secreta `EP_DRAFT="false"` para publicar direto, sem criar Rascunhos (Draft) no GitHub.
5. **Compilação Tríplice:** Gera o instalador silencioso para Windows `.exe`, o do Mac `.dmg` e do Linux `.deb`.
6. **Upload Final:** Faz o upload dos arquivos de auto-update (`latest.yml`) de cada OS para as Releases do Github.

Pronto! Assim que a barra no terminal terminar, qualquer aplicativo instalado pelo mundo fará o download e atualizará sozinho no próximo login do usuário.
