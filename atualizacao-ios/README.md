# Automação de Atualizações - Admin iOS

Esta pasta contém o script para compilar o painel administrativo (`inject-ig-admin`) para o seu iPhone (formato `.ipa`).

## Requisitos

1. Você precisa ter o **Xcode** instalado no Mac.
2. Seu Xcode deve estar logado com a sua conta da **Apple (Apple ID)** para poder assinar o aplicativo.
3. Se o script falhar ao assinar (Code Signing), você pode abrir o Xcode manualmente pela primeira vez e selecionar o seu time:
   - Vá na pasta `inject-ig-admin/ios/App/`
   - Abra o arquivo `App.xcworkspace`
   - Vá na guia "Signing & Capabilities" e escolha o seu Personal Team.

## Como Executar

Sempre que terminar as modificações no Painel Admin e quiser gerar a versão final para o iPhone, basta abrir o terminal e rodar:

```bash
cd /Users/macbookpro/Downloads/Seguranca/atualizacao-ios
./build_ios.sh
```

Ele irá:
- Sincronizar as alterações da Web para o Capacitor iOS.
- Usar o Xcode via terminal para compilar (`xcodebuild`).
- Exportar o arquivo **.ipa** pronto para você instalar no seu celular.
