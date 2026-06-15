import { FastifyInstance } from 'fastify'
import prisma from '../database'
import { authenticate } from '../middleware/authenticate'
import { z } from 'zod'

export default async function lotesRoutes(app: FastifyInstance) {

  // ─── POST /lotes ──────────────────────────────────────────────────────────
  // Adiciona ou atualiza lote de sêmen para touro existente (entrada de estoque)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      id: z.string().uuid().optional(),
      touroId: z.string().uuid(),
      tipo: z.enum(['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA']),
      quantidade: z.number().int().min(1),
      valorUnitario: z.number().min(0),
      codigoPalheta: z.string().optional(),
      caneca: z.string().optional(),
      botijao: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const { contaId } = request.user as { contaId: string }
    const { id, touroId, ...loteData } = parsed.data

    // Verifica se o touro pertence à conta
    const touro = await prisma.touro.findFirst({ where: { id: touroId, contaId, deletedAt: null } })
    if (!touro) return reply.status(404).send({ error: 'Touro não encontrado.' })

    // Verifica se já existe lote do mesmo tipo para este touro
    const loteExistente = await prisma.loteSemen.findFirst({
      where: { touroId, tipo: loteData.tipo, contaId, deletedAt: null },
    })

    let lote
    if (loteExistente) {
      // Incrementa o estoque existente
      lote = await prisma.loteSemen.update({
        where: { id: loteExistente.id },
        data: {
          quantidade: { increment: loteData.quantidade },
          valorUnitario: loteData.valorUnitario,
          codigoPalheta: loteData.codigoPalheta ?? loteExistente.codigoPalheta,
          caneca: loteData.caneca ?? loteExistente.caneca,
          botijao: loteData.botijao ?? loteExistente.botijao,
        },
      })
    } else {
      lote = await prisma.loteSemen.create({
        data: {
          ...(id ? { id } : {}),
          touroId,
          contaId,
          ...loteData,
        },
      })
    }

    return reply.status(201).send(lote)
  })

  // ─── PATCH /lotes/:id ─────────────────────────────────────────────────────
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId } = request.user as { contaId: string }

    const schema = z.object({
      quantidade: z.number().int().min(0).optional(),
      valorUnitario: z.number().min(0).optional(),
      codigoPalheta: z.string().optional(),
      caneca: z.string().optional(),
      botijao: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const lote = await prisma.loteSemen.findFirst({ where: { id, contaId, deletedAt: null } })
    if (!lote) return reply.status(404).send({ error: 'Lote não encontrado.' })

    const atualizado = await prisma.loteSemen.update({
      where: { id },
      data: parsed.data,
    })

    return reply.send(atualizado)
  })

  // ─── DELETE /lotes/:id ────────────────────────────────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId, papel } = request.user as { contaId: string; papel: string }

    if (papel !== 'ADMIN') {
      return reply.status(403).send({ error: 'Apenas o admin pode excluir lotes.' })
    }

    const lote = await prisma.loteSemen.findFirst({ where: { id, contaId, deletedAt: null } })
    if (!lote) return reply.status(404).send({ error: 'Lote não encontrado.' })

    await prisma.loteSemen.update({ where: { id }, data: { deletedAt: new Date() } })

    return reply.status(204).send()
  })
}
