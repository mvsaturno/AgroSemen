#!/bin/bash
# =============================================================================
# AgroSemen — Deploy Local do Backend de dentro da VM
# Executar este script de DENTRO da VM
# =============================================================================

set -euo pipefail

# Pasta onde este script está localizado
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "============================================="
echo "⚙️  Iniciando deploy local do backend na VM..."
echo "============================================="
echo ""

# 1. Instalar dependências completas (para ter o TypeScript/tsc)
echo "[1/4] Instalando dependências (incluindo devDependencies)..."
npm install

# 2. Compilar TypeScript
echo "[2/4] Compilando TypeScript (src -> dist)..."
npm run build

# 3. Gerar Prisma Client e rodar migrations
echo "[3/4] Atualizando Prisma e banco de dados..."
npx prisma generate
npx prisma migrate deploy

# 4. Reiniciar a API no PM2
echo "[4/4] Reiniciando serviço no PM2..."
if pm2 list | grep -q "agrosemen-api"; then
  echo "Recarregando processo PM2 existente..."
  pm2 reload agrosemen-api
else
  echo "Iniciando novo processo PM2..."
  pm2 start dist/index.js --name agrosemen-api --env production
  pm2 save
fi

echo ""
echo "============================================="
echo "✅ Backend atualizado e rodando localmente na VM!"
echo "============================================="
echo ""
