# Empacotamento e Distribuição

A estrutura foi otimizada para compilação multiplataforma usando o `electron-builder`.

## 1. Pré-requisitos
Certifique-se de estar dentro do diretório `/inject-ig-console` ao executar qualquer comando de compilação.
Todos os pacotes já foram instalados. Você precisa ter o banco PostgreSQL devidamente exposto e configurado no `main.js` para que o app distribuído consiga acessá-lo.

## 2. Compilar para Mac (macOS)
Gera o aplicativo `.app` encapsulado e o instalador interativo `.dmg`.

```bash
npm run dist:mac
```

Os arquivos finais estarão na pasta `dist-mac/`. O executável `.dmg` terá atualizações automáticas gerenciadas se o `electron-updater` for conectado a um repositório GitHub Release no futuro.

## 3. Compilar para Windows
Gera um instalador `.exe` utilizando o framework NSIS, garantindo instalação "one-click" limpa na máquina de destino.

```bash
npm run dist:win
```

## 4. Compilar para Linux
Gera um pacote AppImage (o formato universal para a grande maioria das distribuições Linux: Ubuntu, Fedora, Debian, etc) e também suporte nativo ao gerenciador Snap.

```bash
npm run dist:linux
```

## 5. Estratégia de Deploy
Sempre que quiser liberar uma nova versão para os seus usuários (o "app mestre" e clientes), basta alterar a tag `"version": "2.X.X"` no seu `package.json`, rodar o build correspondente à máquina do cliente e entregar o instalador a eles.
