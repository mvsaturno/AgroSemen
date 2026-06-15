import { FastifyInstance } from 'fastify'
import prisma from '../database'
import { authenticate } from '../middleware/authenticate'
import { z } from 'zod'

export default async function inseminacoesRoutes(app: FastifyInstance) {

  // ─── GET /inseminacoes ────────────────────────────────────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { contaId } = request.user as { contaId: string }

    const query = z.object({
      de: z.string().optional(),       // data inicial YYYY-MM-DD
      ate: z.string().optional(),      // data final YYYY-MM-DD
      clienteId: z.string().optional(),
      touroId: z.string().optional(),
    })

    const q = query.parse(request.query)

    const inseminacoes = await prisma.inseminacao.findMany({
      where: {
        contaId,
        deletedAt: null,
        ...(q.de || q.ate ? {
          dataInseminacao: {
            ...(q.de ? { gte: new Date(q.de) } : {}),
            ...(q.ate ? { lte: new Date(q.ate + 'T23:59:59') } : {}),
          }
        } : {}),
        ...(q.clienteId ? { clienteId: q.clienteId } : {}),
        ...(q.touroId ? { touroId: q.touroId } : {}),
      },
      include: {
        touro: { select: { nome: true, raca: true, codigoRegistro: true } },
        loteSemen: { select: { tipo: true } },
        usuario: { select: { nome: true } },
        cliente: { select: { nome: true, fazenda: true } },
      },
      orderBy: { dataInseminacao: 'desc' },
    })

    return reply.send(inseminacoes)
  })

  // ─── POST /inseminacoes ───────────────────────────────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      id: z.string().uuid().optional(), // UUID gerado offline
      touroId: z.string().uuid(),
      loteSemenId: z.string().uuid(),
      clienteId: z.string().uuid().optional().nullable(),
      identificacaoVaca: z.string().optional(),
      valorCobrado: z.number().optional().nullable(),
      nota: z.string().optional(),
      dataInseminacao: z.string(), // ISO date string
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const { contaId, sub: usuarioId } = request.user as { contaId: string; sub: string }
    const { id, dataInseminacao, ...data } = parsed.data

    // Normaliza a data para 00:00h UTC
    const dataDate = new Date(dataInseminacao)
    dataDate.setUTCHours(0, 0, 0, 0)

    // Verifica se o lote pertence à conta e tem saldo
    const lote = await prisma.loteSemen.findFirst({
      where: { id: data.loteSemenId, contaId, deletedAt: null },
    })
    if (!lote) return reply.status(404).send({ error: 'Lote de sêmen não encontrado.' })
    if (lote.quantidade < 1) return reply.status(400).send({ error: 'Estoque insuficiente para este lote.' })

    // Cria inseminação e decrementa estoque em transação
    const [inseminacao] = await prisma.$transaction([
      prisma.inseminacao.create({
        data: {
          ...(id ? { id } : {}),
          contaId,
          usuarioId,
          touroId: data.touroId,
          loteSemenId: data.loteSemenId,
          clienteId: data.clienteId,
          identificacaoVaca: data.identificacaoVaca,
          valorCobrado: data.valorCobrado,
          nota: data.nota,
          dataInseminacao: dataDate,
        },
        include: {
          touro: { select: { nome: true, raca: true } },
          loteSemen: { select: { tipo: true } },
          usuario: { select: { nome: true } },
          cliente: { select: { nome: true } },
        },
      }),
      prisma.loteSemen.update({
        where: { id: data.loteSemenId },
        data: { quantidade: { decrement: 1 } },
      }),
    ])

    return reply.status(201).send(inseminacao)
  })

  // ─── PATCH /inseminacoes/:id ──────────────────────────────────────────────
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId, sub: usuarioId, papel } = request.user as {
      contaId: string; sub: string; papel: string
    }

    const schema = z.object({
      clienteId: z.string().uuid().optional().nullable(),
      identificacaoVaca: z.string().optional(),
      valorCobrado: z.number().optional().nullable(),
      nota: z.string().optional(),
      dataInseminacao: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const inseminacao = await prisma.inseminacao.findFirst({
      where: { id, contaId, deletedAt: null }
    })
    if (!inseminacao) return reply.status(404).send({ error: 'Inseminação não encontrada.' })

    // Usuário só pode editar seus próprios registros; Admin pode editar qualquer um
    if (papel !== 'ADMIN' && inseminacao.usuarioId !== usuarioId) {
      return reply.status(403).send({ error: 'Você só pode editar seus próprios registros.' })
    }

    const updateData: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.dataInseminacao) {
      const d = new Date(parsed.data.dataInseminacao)
      d.setUTCHours(0, 0, 0, 0)
      updateData.dataInseminacao = d
    }

    const atualizado = await prisma.inseminacao.update({
      where: { id },
      data: updateData,
      include: {
        touro: { select: { nome: true, raca: true } },
        loteSemen: { select: { tipo: true } },
        cliente: { select: { nome: true } },
      },
    })

    return reply.send(atualizado)
  })

  // ─── DELETE /inseminacoes/:id ─────────────────────────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId, sub: usuarioId, papel } = request.user as {
      contaId: string; sub: string; papel: string
    }

    const inseminacao = await prisma.inseminacao.findFirst({
      where: { id, contaId, deletedAt: null }
    })
    if (!inseminacao) return reply.status(404).send({ error: 'Inseminação não encontrada.' })

    if (papel !== 'ADMIN' && inseminacao.usuarioId !== usuarioId) {
      return reply.status(403).send({ error: 'Você só pode excluir seus próprios registros.' })
    }

    // Soft delete + restaura o estoque
    await prisma.$transaction([
      prisma.inseminacao.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.loteSemen.update({
        where: { id: inseminacao.loteSemenId },
        data: { quantidade: { increment: 1 } },
      }),
    ])

    return reply.status(204).send()
  })
}
