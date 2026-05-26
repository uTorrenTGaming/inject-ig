#!/bin/bash

# ==============================================================================
# SCRIPT DE DEPLOY AUTOMÁTICO - INJECT-IG
# ==============================================================================
# Este script sobe uma nova atualização do aplicativo para o GitHub e já publica
# a versão final (sem rascunhos) para Windows, Mac e Linux automaticamente.
# ==============================================================================

# Para a execução se ocorrer algum erro
set -e

# Cores para o log
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Iniciando Deploy Automático do Inject-IG...${NC}\n"

# 1. Entra na pasta do console (voltando 1 nível da pasta atualizacao)
cd "$(dirname "$0")/../inject-ig-console"

# 2. Atualiza a versão no package.json automaticamente (ex: 2.0.1 -> 2.0.2)
echo -e "${GREEN}[1/5] 📦 Atualizando versão...${NC}"
NEW_VERSION=$(npm version patch)
echo "Nova versão gerada: $NEW_VERSION"

# 3. Salva a nova versão no GitHub
echo -e "\n${GREEN}[2/5] 💾 Salvando alterações no GitHub...${NC}"
git add .
git commit -m "Deploy automático de atualização: $NEW_VERSION" || true
git -c credential.helper= push origin main

# 4. Limpa a memória do Mac para evitar travamentos do hdiutil (aquele erro 404 de antes)
echo -e "\n${GREEN}[3/5] 🧹 Limpando sistema de discos do Mac...${NC}"
rm -rf dist.nosync
hdiutil info | grep "/Volumes/inject-ig" | awk '{print $1}' | xargs -I {} hdiutil detach {} -force 2>/dev/null || true

# 5. Configura as variáveis de envio
# O segredo mágico: EP_DRAFT="false" força o sistema a publicar oficialmente ao invés de salvar como Rascunho!
if [ -z "$GH_TOKEN" ]; then
    echo -e "${CYAN}⚠️ Atenção: A variável GH_TOKEN não está definida. Certifique-se de exportá-la antes de rodar o script ou configurar no seu ambiente.${NC}"
    exit 1
fi
export EP_DRAFT="false"

# 6. Compila e publica as 3 versões!
echo -e "\n${GREEN}[4/5] 🌐 Compilando e enviando para os servidores (Mac, Windows e Linux separadamente para economizar espaço)...${NC}"
echo "Isso pode levar alguns minutos. Vá pegar um café! ☕"

# Build Mac
echo -e "\n${CYAN}>>> Compilando versão Mac...${NC}"
npx electron-builder --mac -p always
rm -rf ../dist.nosync/mac  # Limpa o cache desempacotado do mac
rm -f ../dist.nosync/*.dmg ../dist.nosync/*.zip ../dist.nosync/*.blockmap

# Build Windows
echo -e "\n${CYAN}>>> Compilando versão Windows...${NC}"
npx electron-builder --win -p always
rm -rf ../dist.nosync/win-unpacked  # Limpa o cache desempacotado do windows
rm -f ../dist.nosync/*.exe ../dist.nosync/*.blockmap

# Build Linux
echo -e "\n${CYAN}>>> Compilando versão Linux...${NC}"
npx electron-builder --linux -p always
rm -rf ../dist.nosync/linux-unpacked || true
rm -f ../dist.nosync/*.AppImage ../dist.nosync/*.deb

echo -e "\n${GREEN}[5/5] ✅ DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo "A versão $NEW_VERSION está no ar e todos os computadores infectados/clientes vão baixá-la agora mesmo!"
