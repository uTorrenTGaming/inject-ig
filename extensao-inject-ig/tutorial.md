🕵️ inject-IG - Developer Security Overlay (Stealth Mode)

O inject-IG é uma ferramenta de auditoria e inspeção cirúrgica com uma interface imersiva no estilo clássico do Windows 7 (Aero Glass). Ele é projetado para operar em modo furtivo (Stealth) — não renderiza nada na tela até ser invocado e opera flutuando sobre qualquer projeto web seu.

🔑 O Atalho Mestre

Não importa o método de injeção que você escolha, a interface gráfica sempre permanecerá escondida até você pressionar a combinação secreta:

Ctrl + Shift + D (Pressione novamente para esconder)

💻 Comandos do Terminal (Prompt CMD)

O painel de controle possui um console estilo MS-DOS funcional. Ao abri-lo, você pode usar ferramentas reais de engenharia reversa no DOM da página:

help - Lista os comandos disponíveis.

status - Mostra o status do motor e a contagem de elementos na tela.

cls ou clear - Limpa a tela do console.

search <palavra> - Varre o HTML, textos visíveis, tags de scripts e o LocalStorage em busca de qualquer termo (Ex: search api_key).

extract emails - Usa Regex (Expressões Regulares) para caçar e listar todos os e-mails escondidos no código-fonte.

extract links - Mapeia todas as rotas e links de saída (mesmo os ocultos).

extract forms - Lista todos os formulários da tela, seus métodos (GET/POST) e para onde estão enviando os dados.

🌍 Como usar em Sites Reais (HTTPS / Produção)

O Google Chrome bloqueia ferramentas locais (localhost) de rodarem em sites reais que possuem cadeado de segurança (HTTPS). Para contornar isso com a Extensão ou via Console, siga este passo a passo:

Abra o terminal na pasta overlay-ui e rode o comando: npm run build

Ele vai gerar uma pasta chamada dist. Essa pasta contém o código traduzido e minificado.

Faça o upload dessa pasta dist para a nuvem (Pode ser uma pasta secreta no servidor do seu site real, um Bucket da AWS, Hostinger, Vercel, etc). Ela deve ser acessível via link com https://.

Abra o arquivo content.js da sua Extensão (ou o seu script de Console).

Descomente a "Opção 2 (Modo Produção)" e cole o link real de onde seus arquivos .js e .css ficaram hospedados na internet.

Vá em chrome://extensions/ e clique em Atualizar no card da sua extensão. Pronto! Agora ela injetará a ferramenta online em qualquer site seu!

🚀 Como Injetar a Ferramenta (3 Métodos)

Você possui um arsenal com 3 formas diferentes de colocar o inject-IG para rodar em um site. Escolha a que melhor se adapta ao momento:

Método 1: Plug and Play (Injeção no Código Fonte)

Ideal para deixar a ferramenta nativamente escondida dentro do seu próprio projeto (PHP, HTML, Java).

Rode npm run build na pasta overlay-ui.

Arraste a pasta dist gerada para dentro do seu projeto hospedeiro.

Cole as tags abaixo no <head> do seu site:

<script type="module" crossorigin src="./dist/assets/inject-ig-overlay-injector.js"></script>
<link rel="stylesheet" crossorigin href="./dist/assets/inject-ig-overlay-injector.css">


Método 2: Injeção Tática via Console (Inspecionar Elemento)

Ideal para testes rápidos em sites onde você não quer mexer no código-fonte.

Abra qualquer site seu no Google Chrome.

Aperte F12 (Inspecionar) e vá na aba Console.

Cole o código abaixo (trocando o link pelo seu online, caso seja um site HTTPS) e dê Enter:

(function() {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = "https://SEU_SITE.com/dist/assets/inject-ig-overlay-injector.js"; 
    document.body.appendChild(script);
    console.log("✅ inject-IG carregado. Pressione Ctrl+Shift+D.");
})();


Método 3: A Extensão do Google Chrome (Automático e Definitivo)

Ideal para quando você quer que a ferramenta sempre apareça automaticamente quando você acessar seus sites.

Tenha a pasta extensao-inject-ig criada no seu computador (com os arquivos manifest.json e content.js).

Abra o Google Chrome e digite na barra de endereços: chrome://extensions/

No canto superior direito, ative o "Modo do desenvolvedor".

No canto superior esquerdo, clique no botão "Carregar sem compactação".

Selecione a pasta extensao-inject-ig.

Configure o arquivo content.js com o seu link de produção, clique em atualizar, e ela fará a injeção automaticamente!