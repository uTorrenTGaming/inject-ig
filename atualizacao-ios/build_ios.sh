#!/bin/bash

# ==============================================================================
# SCRIPT DE DEPLOY AUTOMÁTICO iOS - INJECT-IG ADMIN
# ==============================================================================
# Este script sobe uma nova atualização do painel Admin para o GitHub
# e utiliza o Xcode para compilar o arquivo final .ipa.
# ==============================================================================

set -e

# Cores para o log
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}🚀 Iniciando Deploy Automático do Inject-IG Admin (iOS)...${NC}\n"

# 1. Entra na pasta do Admin
cd "$(dirname "$0")/../inject-ig-admin"

# Carregar variáveis de ambiente do .env do console (onde o GH_TOKEN está)
if [ -f "../inject-ig-console/.env" ]; then
    set -a
    source "../inject-ig-console/.env"
    set +a
fi

if [ -z "$GH_TOKEN" ]; then
    echo -e "${CYAN}⚠️ Atenção: A variável GH_TOKEN não está definida no .env!${NC}"
    exit 1
fi

# 2. Atualiza a versão no package.json automaticamente
echo -e "\n${GREEN}[1/5] 📦 Atualizando versão do App Admin...${NC}"
NEW_VERSION=$(npm version patch)
echo "Nova versão gerada: $NEW_VERSION"

# 3. Salva a nova versão no GitHub
echo -e "\n${GREEN}[2/5] 💾 Salvando alterações no GitHub...${NC}"
git add . 2>/dev/null || true
git add ../atualizacao-ios/build_ios.sh 2>/dev/null || true
git commit -m "Deploy automático de atualização do Admin: $NEW_VERSION" || true
git -c credential.helper= push https://$GH_TOKEN@github.com/uTorrenTGaming/inject-ig.git main || true

# 4. Sincroniza o Capacitor (Web -> iOS)
echo -e "\n${GREEN}[3/5] 🔄 Sincronizando Código Web com Projeto Nativo iOS...${NC}"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
    nvm use 22 || nvm install 22
fi
npm run ios

# 5. Compilação Xcode para .ipa
echo -e "\n${GREEN}[4/5] 🍏 Compilando via Xcode...${NC}"
echo "Isso pode levar alguns minutos. O Xcode está construindo os binários."

cd ios/App

# (Capacitor usa Swift Package Manager automaticamente, pod install não é necessário)

# Define as pastas
ARCHIVE_PATH="build/App.xcarchive"
EXPORT_PATH="build"
PLIST_PATH="../../../atualizacao-ios/exportOptions.plist"

# Passo A: Arquivar o projeto (.xcarchive)
echo -e "\n${CYAN}>>> Arquivando projeto Xcode...${NC}"
/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -project App.xcodeproj \
           -scheme App \
           -configuration Release \
           -archivePath "$ARCHIVE_PATH" \
           clean archive \
           -allowProvisioningUpdates || {
               echo -e "${RED}❌ Falha na compilação do Xcode!${NC}"
               echo -e "DICA: O seu Mac provavelmente não está com uma conta Apple Developer logada."
               echo -e "Abra o arquivo 'ios/App/App.xcodeproj' no Xcode, vá em 'Signing & Capabilities' e assine o projeto."
               exit 1
           }

# Passo B: Exportar para .ipa
echo -e "\n${CYAN}>>> Exportando para formato .ipa...${NC}"
/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -exportArchive \
           -archivePath "$ARCHIVE_PATH" \
           -exportOptionsPlist "$PLIST_PATH" \
           -exportPath "$EXPORT_PATH" \
           -allowProvisioningUpdates

echo -e "\n${GREEN}[5/5] ✅ DEPLOY iOS CONCLUÍDO COM SUCESSO!${NC}"
echo "Você encontrará seu arquivo App.ipa em:"
echo "inject-ig-admin/ios/App/build/App.ipa"
