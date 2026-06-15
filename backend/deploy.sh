#!/bin/bash
# =============================================================================
# AgroSemen — Deploy do Backend para a VM Oracle
# Uso: bash deploy.sh
# Requer: SSH configurado com chave privada
# =============================================================================

set -euo pipefail

VM_HOST="${VM_HOST:-ubuntu@163.176.47.4}"
VM_PATH="/opt/agrosemen/backend"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "🚀 Fazendo deploy do backend para ${VM_HOST}:${VM_PATH}"
echo ""

# 1. Build local
echo "[1/4] Compilando TypeScript..."
cd "$LOCAL_PATH"
npm run build

# 2. Copia arquivos para a VM (exclui node_modules e .env local)
echo "[2/4] Enviando arquivos para a VM..."
rsync -avz --progress \
  --exclude='.env' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='dist/' \
  "$LOCAL_PATH/" \
  "${VM_HOST}:${VM_PATH}/"

# 3. Instala dependências na VM e roda migrations
echo "[3/4] Instalando dependências e rodando migrations..."
ssh "$VM_HOST" << 'ENDSSH'
  cd /opt/agrosemen/backend
  npm ci --omit=dev
  npx prisma generate
  npx prisma migrate deploy
ENDSSH

# 4. Reinicia o serviço do backend (via PM2)
echo "[4/4] Reiniciando o serviço..."
ssh "$VM_HOST" << 'ENDSSH'
  cd /opt/agrosemen/backend

  # Instala PM2 se não existir
  if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
  fi

  # Inicia ou reinicia o serviço
  if pm2 list | grep -q "agrosemen-api"; then
    pm2 reload agrosemen-api
  else
    pm2 start dist/index.js --name agrosemen-api --env production
    pm2 save
    pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash
  fi
ENDSSH

echo ""
echo "✅ Deploy concluído!"
echo "   API disponível em: http://163.176.47.4/api/health"
echo ""
