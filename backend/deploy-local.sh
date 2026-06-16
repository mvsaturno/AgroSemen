#!/bin/bash
# =============================================================================
# AgroSemen — Deploy Local do Backend de dentro da VM (Evitando erro de EPERM no Mount)
# Executar este script de DENTRO da VM na pasta montada:
# /mnt/c/Users/mv_sa/Documents/Development/AgroSemen/backend
# =============================================================================

set -euo pipefail

# Diretório de origem (a pasta montada do Windows)
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Diretório de destino (diretório nativo da VM Linux, sem problemas de NTFS/EPERM)
DEST_DIR="/home/saturno/agrosemen-backend-native"

echo ""
echo "============================================================"
echo "⚙️  Deploy Local VM: Copiando para diretório nativo Linux..."
echo "============================================================"
echo "Origem: $SRC_DIR"
echo "Destino: $DEST_DIR"
echo ""

# Garante que o diretório de destino existe e tem permissões corretas
mkdir -p "$DEST_DIR"

# 1. Copiar arquivos usando rsync local (exclui node_modules, .env, dist)
echo "[1/5] Sincronizando arquivos para a partição Linux nativa..."
rsync -av --delete \
  --exclude='.env' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='dist/' \
  "$SRC_DIR/" "$DEST_DIR/"

# Se o arquivo .env não existir no destino nativo, copia o da pasta montada
if [ ! -f "$DEST_DIR/.env" ]; then
  echo "Copiando .env da pasta montada para a pasta nativa..."
  cp "$SRC_DIR/.env" "$DEST_DIR/.env" || true
fi

# Navega para o diretório de destino nativo
cd "$DEST_DIR"

# 2. Instalar dependências completas no diretório nativo
echo "[2/5] Instalando dependências (incluindo devDependencies)..."
npm install

# 3. Compilar TypeScript
echo "[3/5] Compilando TypeScript (src -> dist)..."
npm run build

# 4. Gerar Prisma Client e rodar migrations
echo "[4/5] Atualizando Prisma e banco de dados..."
npx prisma generate
npx prisma migrate deploy

# 5. Reiniciar a API no PM2
echo "[5/5] Reiniciando serviço no PM2..."
if pm2 list | grep -q "agrosemen-api"; then
  echo "Recarregando processo PM2 existente..."
  pm2 reload agrosemen-api
else
  echo "Iniciando novo processo PM2..."
  pm2 start dist/index.js --name agrosemen-api --env production
  pm2 save
fi

echo ""
echo "============================================================"
echo "✅ Backend atualizado e rodando em: $DEST_DIR"
echo "============================================================"
echo ""
