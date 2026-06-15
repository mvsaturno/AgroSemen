import { FastifyInstance } from 'fastify'
import prisma from '../database'
import { authenticate } from '../middleware/authenticate'
import { z } from 'zod'

export default async function tourosRoutes(app: FastifyInstance) {

  // ─── GET /touros ──────────────────────────────────────────────────────────
  // Lista todos os touros da conta com saldo calculado por tipo de sêmen
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { contaId } = request.user as { contaId: string }

    const touros = await prisma.touro.findMany({
      where: { contaId, deletedAt: null },
      include: {
        lotes: {
          where: { deletedAt: null },
          select: {
            id: true,
            tipo: true,
            quantidade: true,
            valorUnitario: true,
            codigoPalheta: true,
            caneca: true,
            botijao: true,
            updatedAt: true,
          },
          orderBy: { tipo: 'asc' },
        },
      },
      orderBy: [{ raca: 'asc' }, { nome: 'asc' }],
    })

    return reply.send(touros)
  })

  // ─── POST /touros ─────────────────────────────────────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      id: z.string().uuid().optional(), // UUID gerado no client (offline)
      nome: z.string().min(1),
      codigoRegistro: z.string().optional(),
      raca: z.string().min(1),
      empresaFornecedora: z.string().optional(),
      fotoUrl: z.string().optional(),
      lotes: z.array(z.object({
        id: z.string().uuid().optional(),
        tipo: z.enum(['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA']),
        quantidade: z.number().int().min(0),
        valorUnitario: z.number().min(0),
        codigoPalheta: z.string().optional(),
        caneca: z.string().optional(),
        botijao: z.string().optional(),
      })).optional().default([]),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const { contaId } = request.user as { contaId: string }
    const { id, lotes, ...touroData } = parsed.data

    const touro = await prisma.touro.create({
      data: {
        ...(id ? { id } : {}),
        ...touroData,
        contaId,
        lotes: {
          create: lotes
            .filter(l => l.quantidade > 0 || l.codigoPalheta)
            .map(l => ({
              ...(l.id ? { id: l.id } : {}),
              contaId,
              tipo: l.tipo,
              quantidade: l.quantidade,
              valorUnitario: l.valorUnitario,
              codigoPalheta: l.codigoPalheta,
              caneca: l.caneca,
              botijao: l.botijao,
            })),
        },
      },
      include: { lotes: { where: { deletedAt: null } } },
    })

    return reply.status(201).send(touro)
  })

  // ─── PATCH /touros/:id ────────────────────────────────────────────────────
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId } = request.user as { contaId: string }

    const schema = z.object({
      nome: z.string().min(1).optional(),
      codigoRegistro: z.string().optional(),
      raca: z.string().optional(),
      empresaFornecedora: z.string().optional(),
      fotoUrl: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const touro = await prisma.touro.findFirst({ where: { id, contaId, deletedAt: null } })
    if (!touro) return reply.status(404).send({ error: 'Touro não encontrado.' })

    const atualizado = await prisma.touro.update({
      where: { id },
      data: parsed.data,
      include: { lotes: { where: { deletedAt: null } } },
    })

    return reply.send(atualizado)
  })

  // ─── DELETE /touros/:id ───────────────────────────────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId, papel } = request.user as { contaId: string; papel: string }

    if (papel !== 'ADMIN') {
      return reply.status(403).send({ error: 'Apenas o admin pode excluir touros.' })
    }

    const touro = await prisma.touro.findFirst({ where: { id, contaId, deletedAt: null } })
    if (!touro) return reply.status(404).send({ error: 'Touro não encontrado.' })

    // Soft delete no touro e em todos os lotes
    await prisma.$transaction([
      prisma.touro.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.loteSemen.updateMany({ where: { touroId: id }, data: { deletedAt: new Date() } }),
    ])

    return reply.status(204).send()
  })
}
