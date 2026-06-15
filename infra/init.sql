-- AgroSemen — Migration inicial (gerada pelo Prisma)
-- Execute com: docker exec -i agrosemen_postgres psql -U agrosemen -d agrosemen_prod < init.sql

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('USO_PROPRIO', 'PRESTADOR');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'USUARIO');

-- CreateEnum
CREATE TYPE "TipoSemen" AS ENUM ('CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA');

-- CreateEnum
CREATE TYPE "StatusReserva" AS ENUM ('PENDENTE', 'ATENDIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "contas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whatsappCatalogo" TEXT,
    "perfil" "Perfil" NOT NULL DEFAULT 'USO_PROPRIO',
    "estoqueMinAlerta" INTEGER NOT NULL DEFAULT 5,
    "valorPadraoCon" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorPadraoSex" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'USUARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "touros" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigoRegistro" TEXT,
    "raca" TEXT NOT NULL,
    "empresaFornecedora" TEXT,
    "fotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "touros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_semen" (
    "id" TEXT NOT NULL,
    "touroId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "tipo" "TipoSemen" NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "valorUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "codigoPalheta" TEXT,
    "caneca" TEXT,
    "botijao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lotes_semen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "fazenda" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inseminacoes" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "touroId" TEXT NOT NULL,
    "loteSemenId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "clienteId" TEXT,
    "identificacaoVaca" TEXT,
    "valorCobrado" DECIMAL(10,2),
    "nota" TEXT,
    "dataInseminacao" TIMESTAMP(3) NOT NULL,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inseminacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intencoes_reserva" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "touroId" TEXT NOT NULL,
    "nomeComprador" TEXT NOT NULL,
    "telefoneComprador" TEXT,
    "tipoSemen" "TipoSemen" NOT NULL,
    "status" "StatusReserva" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intencoes_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_metadata" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_slug_key" ON "contas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_inviteToken_key" ON "usuarios"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_telefone_contaId_key" ON "usuarios"("telefone", "contaId");

-- CreateIndex
CREATE UNIQUE INDEX "sync_metadata_usuarioId_deviceId_key" ON "sync_metadata"("usuarioId", "deviceId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "touros" ADD CONSTRAINT "touros_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_semen" ADD CONSTRAINT "lotes_semen_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES "touros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_semen" ADD CONSTRAINT "lotes_semen_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inseminacoes" ADD CONSTRAINT "inseminacoes_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inseminacoes" ADD CONSTRAINT "inseminacoes_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES "touros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inseminacoes" ADD CONSTRAINT "inseminacoes_loteSemenId_fkey" FOREIGN KEY ("loteSemenId") REFERENCES "lotes_semen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inseminacoes" ADD CONSTRAINT "inseminacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inseminacoes" ADD CONSTRAINT "inseminacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intencoes_reserva" ADD CONSTRAINT "intencoes_reserva_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intencoes_reserva" ADD CONSTRAINT "intencoes_reserva_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES "touros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
