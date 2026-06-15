#!/bin/bash
# =============================================================================
# AgroSemen — Setup da VM Oracle (Ubuntu 20.04/22.04/24.04)
# Instala: Docker, PostgreSQL (container interno), Nginx (reverse proxy)
# PostgreSQL NÃO é exposto externamente — acesso apenas pelo backend Node.js
# =============================================================================

set -euo pipefail

echo ""
echo "============================================="
echo "  AgroSemen — Setup da VM Oracle"
echo "============================================="
echo ""

# -----------------------------------------------------------------------------
# 1. Atualizar sistema
# -----------------------------------------------------------------------------
echo "[1/7] Atualizando sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y

# -----------------------------------------------------------------------------
# 2. Instalar dependências
# -----------------------------------------------------------------------------
echo "[2/7] Instalando dependências base..."
sudo apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  ufw \
  nginx \
  git \
  unzip

# -----------------------------------------------------------------------------
# 3. Instalar Docker
# -----------------------------------------------------------------------------
echo "[3/7] Instalando Docker..."

# Remove versões antigas se houver
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Adiciona repositório oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Adiciona usuário atual ao grupo docker (evita usar sudo)
sudo usermod -aG docker "$USER"

# Habilita Docker na inicialização
sudo systemctl enable docker
sudo systemctl start docker

echo "Docker instalado: $(docker --version)"

# -----------------------------------------------------------------------------
# 4. Instalar Node.js 20 LTS (para o backend)
# -----------------------------------------------------------------------------
echo "[4/7] Instalando Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Node.js instalado: $(node --version)"
echo "npm instalado: $(npm --version)"

# -----------------------------------------------------------------------------
# 5. Criar estrutura de diretórios do projeto
# -----------------------------------------------------------------------------
echo "[5/7] Criando estrutura de diretórios..."

sudo mkdir -p /opt/agrosemen/{backend,uploads,postgres-data}
sudo chown -R "$USER":"$USER" /opt/agrosemen

# Pasta de uploads com permissão correta
chmod 755 /opt/agrosemen/uploads

# -----------------------------------------------------------------------------
# 6. Subir PostgreSQL via Docker (interno apenas)
# -----------------------------------------------------------------------------
echo "[6/7] Configurando PostgreSQL via Docker..."

# Gera senha segura aleatória
PG_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)
PG_USER="agrosemen"
PG_DB="agrosemen_prod"

# Salva as credenciais em arquivo seguro
cat > /opt/agrosemen/.env.db << EOF
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=${PG_DB}
DATABASE_URL=postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5432/${PG_DB}
EOF

chmod 600 /opt/agrosemen/.env.db

echo ""
echo "⚠️  CREDENCIAIS DO BANCO — SALVE ISSO EM LOCAL SEGURO:"
echo "---------------------------------------------------"
echo "  Usuário:  ${PG_USER}"
echo "  Senha:    ${PG_PASSWORD}"
echo "  Banco:    ${PG_DB}"
echo "  Arquivo:  /opt/agrosemen/.env.db"
echo "---------------------------------------------------"
echo ""

# Cria docker-compose para o PostgreSQL
cat > /opt/agrosemen/docker-compose.yml << EOF
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: agrosemen_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: ${PG_DB}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /opt/agrosemen/postgres-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"   # Somente localhost — NÃO exposto externamente
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PG_USER} -d ${PG_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
EOF

# Sobe o container
docker compose -f /opt/agrosemen/docker-compose.yml up -d

echo "Aguardando PostgreSQL ficar pronto..."
sleep 8

# Verifica se subiu
docker exec agrosemen_postgres pg_isready -U "$PG_USER" -d "$PG_DB" && \
  echo "✅ PostgreSQL rodando e saudável!" || \
  echo "❌ Problema ao iniciar PostgreSQL — verifique: docker logs agrosemen_postgres"

# -----------------------------------------------------------------------------
# 7. Configurar Nginx como Reverse Proxy
# -----------------------------------------------------------------------------
echo "[7/7] Configurando Nginx..."

# Obtém o IP público da VM para referência
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "SEU_IP_PUBLICO")

# Config Nginx para o backend (porta 3000) e catálogo web (porta 5173)
sudo tee /etc/nginx/sites-available/agrosemen << EOF
# AgroSemen — Nginx Reverse Proxy

# Backend API
server {
    listen 80;
    server_name ${PUBLIC_IP} _;

    # Aumenta limite de upload para fotos de touros
    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    # Fotos estáticas dos touros
    location /uploads/ {
        alias /opt/agrosemen/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Catálogo público web (quando disponível)
    location /catalogo/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Painel admin web (quando disponível)
    location /admin/ {
        proxy_pass http://127.0.0.1:4001/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Ativa o site
sudo ln -sf /etc/nginx/sites-available/agrosemen /etc/nginx/sites-enabled/agrosemen
sudo rm -f /etc/nginx/sites-enabled/default

# Testa e recarrega Nginx
sudo nginx -t && sudo systemctl reload nginx

# -----------------------------------------------------------------------------
# 8. Configurar Firewall (UFW)
# -----------------------------------------------------------------------------
echo "[Extra] Configurando Firewall..."

sudo ufw allow OpenSSH       # SSH — NÃO feche isso antes de habilitar o UFW!
sudo ufw allow 'Nginx Full'  # HTTP (80) e HTTPS (443)
sudo ufw --force enable

echo ""
echo "Regras de firewall ativas:"
sudo ufw status

# -----------------------------------------------------------------------------
# 9. Habilitar Docker na inicialização
# -----------------------------------------------------------------------------
sudo systemctl enable docker

# Cria serviço systemd para garantir que os containers sobem com a VM
sudo tee /etc/systemd/system/agrosemen-db.service << 'EOF'
[Unit]
Description=AgroSemen PostgreSQL (Docker)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/agrosemen
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable agrosemen-db.service

# -----------------------------------------------------------------------------
# Resumo Final
# -----------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  ✅ Setup completo!"
echo "============================================="
echo ""
echo "  PostgreSQL:    localhost:5432 (interno)"
echo "  Credenciais:   /opt/agrosemen/.env.db"
echo "  Uploads:       /opt/agrosemen/uploads/"
echo "  Backend dir:   /opt/agrosemen/backend/"
echo "  Nginx:         http://${PUBLIC_IP}"
echo ""
echo "  Rotas configuradas no Nginx:"
echo "    http://${PUBLIC_IP}/api/       → Backend Node.js (porta 3000)"
echo "    http://${PUBLIC_IP}/uploads/   → Fotos dos touros"
echo "    http://${PUBLIC_IP}/catalogo/  → Catálogo público (porta 4000)"
echo "    http://${PUBLIC_IP}/admin/     → Painel admin (porta 4001)"
echo ""
echo "  Próximo passo: fazer deploy do backend Node.js em /opt/agrosemen/backend/"
echo ""
echo "  ⚠️  IMPORTANTE: Faça logout e login novamente (ou execute 'newgrp docker')"
echo "     para usar Docker sem sudo."
echo ""
