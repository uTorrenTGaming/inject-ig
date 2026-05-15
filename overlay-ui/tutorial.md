🕵️ inject-IG - Developer Security Overlay

O inject-IG é uma ferramenta furtiva de auditoria e inspeção desenhada para ser injetada em projetos web próprios.

Ele simula uma janela nativa do "Windows 7" diretamente no navegador do cliente (ou no seu ambiente de testes), proporcionando ferramentas poderosas como leitura do DOM, pesquisa no LocalStorage e mapeamento de arquitetura.

🚀 Como Funciona o Stealth Mode

Quando injetado em um site, o inject-IG fica rodando em background consumindo zero espaço na tela. Não há botões flutuantes ou alertas no console. Ninguém saberá que ele está lá.
Para invocar o painel, o desenvolvedor deve usar a combinação de teclas mestre:

Atalho Mestre: Ctrl + Shift + D

🛠 Como Compilar e Injetar em Qualquer Projeto

O projeto foi construído em React, mas você deve compilar tudo para um único arquivo JavaScript portátil para "arrastar e soltar" em projetos HTML, PHP, Java, etc.

Passo 1: Gerar a build

Abra o terminal na pasta overlay-ui e rode:
npm run build

Passo 2: Pegar o pacote

O sistema gerará uma pasta chamada dist. Dentro de dist/assets/, você encontrará dois arquivos gerados pelo Vite:

inject-ig-overlay-injector.js

inject-ig-overlay-injector.css

Passo 3: Injetar no seu projeto (Plug and Play)

Copie esses dois arquivos para a pasta do seu projeto destino (ex: site em HTML/PHP) e insira isso no <head> do seu HTML:

<!-- Injeção do inject-IG -->
<script type="module" crossorigin src="./assets/inject-ig-overlay-injector.js"></script>
<link rel="stylesheet" crossorigin href="./assets/inject-ig-overlay-injector.css">


📂 O que cada arquivo faz? (Para você, Dev)

src/App.jsx: É o motor da interface gráfica e onde toda a programação visual, botões e funções estão.

src/main.jsx: É o Injetor que gruda a interface gráfica no site da pessoa.

src/index.css: Faz o reset do visual para não quebrar o CSS original do site.