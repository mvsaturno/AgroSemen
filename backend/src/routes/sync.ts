import { FastifyInstance } from 'fastify'
import prisma from '../database'
import { authenticate } from '../middleware/authenticate'
import { z } from 'zod'

// ─── Tipos auxiliares para o sync ─────────────────────────────────────────────

interface SyncPushPayload {
  inseminacoes?: Array<{
    id: string
    touroId: string
    loteSemenId: string
    clienteId?: string | null
    identificacaoVaca?: string
    valorCobrado?: number | null
    nota?: string
    dataInseminacao: string
    deletedAt?: string | null
    updatedAt: string
  }>
  touros?: Array<{
    id: string
    nome: string
    codigoRegistro?: string
    raca: string
    empresaFornecedora?: string
    fotoUrl?: string
    deletedAt?: string | null
    updatedAt: string
  }>
  lotes?: Array<{
    id: string
    touroId: string
    tipo: 'CONVENCIONAL' | 'SEXADO_MACHO' | 'SEXADO_FEMEA'
    quantidade: number
    valorUnitario: number
    codigoPalheta?: string
    caneca?: string
    botijao?: string
    deletedAt?: string | null
    updatedAt: string
  }>
  clientes?: Array<{
    id: string
    nome: string
    telefone?: string
    fazenda?: string
    deletedAt?: string | null
    updatedAt: string
  }>
  intencoesReserva?: Array<{
    id: string
    status: 'PENDENTE' | 'ATENDIDA' | 'CANCELADA'
    updatedAt: string
  }>
}

export default async function syncRoutes(app: FastifyInstance) {

  // ─── POST /sync ──────────────────────────────────────────────────────────
  // Sincronização bidirecional delta
  // - Recebe registros dirty do cliente (push)
  // - Retorna registros novos/atualizados no servidor desde last_synced_at (pull)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      deviceId: z.string(),
      lastSyncedAt: z.string().optional(), // ISO timestamp ou null (primeira sync)
      push: z.object({
        inseminacoes: z.array(z.any()).optional().default([]),
        touros: z.array(z.any()).optional().default([]),
        lotes: z.array(z.any()).optional().default([]),
        clientes: z.array(z.any()).optional().default([]),
        intencoesReserva: z.array(z.any()).optional().default([]),
      }).optional().default({}),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Payload de sync inválido.' })
    }

    const { contaId, sub: usuarioId } = request.user as { contaId: string; sub: string }
    const { deviceId, lastSyncedAt, push } = parsed.data
    const since = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0)
    const syncAt = new Date()

    const pushData = push as SyncPushPayload

    // ── PUSH: aplica registros enviados pelo cliente ──────────────────────
    const errors: string[] = []

    // Touros
    for (const t of pushData.touros || []) {
      try {
        const existente = await prisma.touro.findUnique({ where: { id: t.id } })
        if (existente) {
          if (new Date(t.updatedAt) > existente.updatedAt) {
            await prisma.touro.update({
              where: { id: t.id },
              data: {
                nome: t.nome, codigoRegistro: t.codigoRegistro, raca: t.raca,
                empresaFornecedora: t.empresaFornecedora, fotoUrl: t.fotoUrl,
                deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
              },
            })
          }
        } else {
          await prisma.touro.create({
            data: {
              id: t.id, contaId, nome: t.nome, codigoRegistro: t.codigoRegistro,
              raca: t.raca, empresaFornecedora: t.empresaFornecedora, fotoUrl: t.fotoUrl,
              deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
            },
          })
        }
      } catch (e) {
        errors.push(`Touro ${t.id}: ${e}`)
      }
    }

    // Lotes
    for (const l of pushData.lotes || []) {
      try {
        const existente = await prisma.loteSemen.findUnique({ where: { id: l.id } })
        if (existente) {
          if (new Date(l.updatedAt) > existente.updatedAt) {
            await prisma.loteSemen.update({
              where: { id: l.id },
              data: {
                quantidade: l.quantidade, valorUnitario: l.valorUnitario,
                codigoPalheta: l.codigoPalheta, caneca: l.caneca, botijao: l.botijao,
                deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
              },
            })
          }
        } else {
          await prisma.loteSemen.create({
            data: {
              id: l.id, touroId: l.touroId, contaId, tipo: l.tipo,
              quantidade: l.quantidade, valorUnitario: l.valorUnitario,
              codigoPalheta: l.codigoPalheta, caneca: l.caneca, botijao: l.botijao,
              deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
            },
          })
        }
      } catch (e) {
        errors.push(`Lote ${l.id}: ${e}`)
      }
    }

    // Clientes
    for (const c of pushData.clientes || []) {
      try {
        const existente = await prisma.cliente.findUnique({ where: { id: c.id } })
        if (existente) {
          if (new Date(c.updatedAt) > existente.updatedAt) {
            await prisma.cliente.update({
              where: { id: c.id },
              data: {
                nome: c.nome, telefone: c.telefone, fazenda: c.fazenda,
                deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
              },
            })
          }
        } else {
          await prisma.cliente.create({
            data: {
              id: c.id, contaId, nome: c.nome, telefone: c.telefone,
              fazenda: c.fazenda, deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
            },
          })
        }
      } catch (e) {
        errors.push(`Cliente ${c.id}: ${e}`)
      }
    }

    // Inseminações
    for (const i of pushData.inseminacoes || []) {
      try {
        const dataDate = new Date(i.dataInseminacao)
        dataDate.setUTCHours(0, 0, 0, 0)

        const existente = await prisma.inseminacao.findUnique({ where: { id: i.id } })

        if (existente) {
          // Atualiza apenas se o updatedAt do cliente é mais recente
          if (new Date(i.updatedAt) > existente.updatedAt) {
            await prisma.inseminacao.update({
              where: { id: i.id },
              data: {
                clienteId: i.clienteId,
                identificacaoVaca: i.identificacaoVaca,
                valorCobrado: i.valorCobrado,
                nota: i.nota,
                dataInseminacao: dataDate,
                deletedAt: i.deletedAt ? new Date(i.deletedAt) : null,
                syncedAt: syncAt,
                isDirty: false,
              },
            })
          }
        } else {
          await prisma.inseminacao.create({
            data: {
              id: i.id, contaId, usuarioId, touroId: i.touroId,
              loteSemenId: i.loteSemenId, clienteId: i.clienteId,
              identificacaoVaca: i.identificacaoVaca, valorCobrado: i.valorCobrado,
              nota: i.nota, dataInseminacao: dataDate,
              deletedAt: i.deletedAt ? new Date(i.deletedAt) : null,
              syncedAt: syncAt, isDirty: false,
            },
          })
          // Decrementa estoque — ignora se o lote ainda não existe no servidor
          // (pode chegar via sync de lotes em um ciclo posterior)
          await prisma.loteSemen.update({
            where: { id: i.loteSemenId },
            data: { quantidade: { decrement: 1 } },
          }).catch((e) => {
            app.log.warn(`[sync] Não foi possível decrementar estoque do lote ${i.loteSemenId}: ${e}`)
          })
        }
      } catch (e) {
        errors.push(`Inseminação ${i.id}: ${e}`)
      }
    }

    // Intenções de Reserva (Aprovar/Rejeitar)
    for (const r of pushData.intencoesReserva || []) {
      try {
        const existente = await prisma.intencaoReserva.findUnique({ where: { id: r.id } })
        if (existente && new Date(r.updatedAt) > existente.updatedAt) {
          await prisma.intencaoReserva.update({
            where: { id: r.id },
            data: { status: r.status },
          })
        }
      } catch (e) {
        errors.push(`IntençãoReserva ${r.id}: ${e}`)
      }
    }

    // ── PULL: retorna delta desde last_synced_at ──────────────────────────
    const [touros, lotes, clientes, inseminacoes, intencoesReserva] = await Promise.all([
      prisma.touro.findMany({
        where: { contaId, updatedAt: { gt: since } },
        include: { lotes: { where: { updatedAt: { gt: since } } } },
      }),
      prisma.loteSemen.findMany({
        where: { contaId, updatedAt: { gt: since } },
      }),
      prisma.cliente.findMany({
        where: { contaId, updatedAt: { gt: since } },
      }),
      prisma.inseminacao.findMany({
        where: { contaId, updatedAt: { gt: since } },
        include: {
          touro: { select: { nome: true, raca: true } },
          loteSemen: { select: { tipo: true } },
          cliente: { select: { nome: true } },
          usuario: { select: { nome: true } },
        },
      }),
      prisma.intencaoReserva.findMany({
        where: { contaId, updatedAt: { gt: since } },
        include: {
          touro: { select: { nome: true, raca: true } },
        }
      })
    ])

    // Atualiza metadata de sync do dispositivo
    await prisma.syncMetadata.upsert({
      where: { usuarioId_deviceId: { usuarioId, deviceId } },
      create: { usuarioId, deviceId, lastSyncedAt: syncAt },
      update: { lastSyncedAt: syncAt },
    })

    return reply.send({
      syncedAt: syncAt.toISOString(),
      errors: errors.length > 0 ? errors : undefined,
      pull: { touros, lotes, clientes, inseminacoes, intencoesReserva },
    })
  })
}
