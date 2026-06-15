#!/bin/bash
# =============================================================================
# AgroSemen — Setup do Backend na VM Oracle
# Executa este script NA VM via SSH
# =============================================================================

set -euo pipefail

BACKEND_DIR="/opt/agrosemen/backend"

echo ""
echo "============================================="
echo "  AgroSemen — Setup do Backend na VM"
echo "============================================="
echo ""

# 1. Instala PM2 globalmente se não existir
if ! command -v pm2 &> /dev/null; then
  echo "[1] Instalando PM2..."
  sudo npm install -g pm2
else
  echo "[1] PM2 já instalado: $(pm2 --version)"
fi

# 2. Vai para o diretório do backend
cd "$BACKEND_DIR"

# 3. Instala dependências de produção
echo "[2] Instalando dependências..."
npm ci --omit=dev

# 4. Gera o cliente Prisma
echo "[3] Gerando Prisma Client..."
npx prisma generate

# 5. Roda as migrations
echo "[4] Rodando migrations no banco de dados..."
npx prisma migrate deploy

# 6. Inicia ou reinicia com PM2
echo "[5] Iniciando API com PM2..."
if pm2 list | grep -q "agrosemen-api"; then
  pm2 reload agrosemen-api --update-env
else
  pm2 start dist/index.js \
    --name agrosemen-api \
    --env production \
    --max-memory-restart 300M
  pm2 save
  # Configura PM2 para iniciar com o sistema
  pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null | grep "sudo" | bash || true
fi

echo ""
echo "============================================="
echo "  ✅ Backend rodando!"
echo "============================================="
echo ""
pm2 status agrosemen-api
echo ""
echo "  Teste: curl http://localhost:3000/health"
echo ""
