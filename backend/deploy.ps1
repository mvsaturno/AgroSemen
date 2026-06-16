# =============================================================================
# AgroSemen — Build e Deploy do Backend (Executar no Windows)
# Executar este script no terminal PowerShell do Windows, na pasta do projeto
# =============================================================================

$ErrorActionPreference = "Stop"

# Obter a pasta do script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ($ScriptDir -eq "") { $ScriptDir = Get-Location }

# Forçar navegação para a pasta do backend
cd "$ScriptDir"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "⚙️  Iniciando compilação e migração do Backend no Windows..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Instalar dependências no Windows
Write-Host "[1/4] Instalando dependências no Windows..." -ForegroundColor Yellow
npm install

# 2. Compilar o TypeScript (TS -> JS na pasta dist/)
Write-Host "[2/4] Compilando TypeScript (src -> dist)..." -ForegroundColor Yellow
npm run build

# 3. Gerar o cliente Prisma local
Write-Host "[3/4] Gerando Prisma Client..." -ForegroundColor Yellow
npx prisma generate

# 4. Rodar as migrations no banco de dados da VM (acessando via porta 5433 do Windows)
Write-Host "[4/4] Executando migrações de banco (Porta 5433)..." -ForegroundColor Yellow
npx prisma migrate deploy

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "✅ Compilação e migração concluídas com sucesso no Windows!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "👉 Próximos passos para aplicar as alterações na sua VM:"
Write-Host "1. Envie a pasta 'dist' compilada para o GitHub:"
Write-Host "   git add ."
Write-Host "   git commit -m 'build: backend dist e migrações'"
Write-Host "   git push origin main"
Write-Host ""
Write-Host "2. Acesse sua VM via SSH ou terminal e execute:"
Write-Host "   cd /opt/agrosemen/backend  # (ou a pasta do backend na VM)"
Write-Host "   git pull origin main"
Write-Host "   npm install --omit=dev     # (apenas para atualizar dependências de produção, sem compilar)"
Write-Host "   pm2 reload agrosemen-api   # (reinicia o backend no PM2)"
Write-Host ""
