import { FastifyInstance } from 'fastify'
import prisma from '../database'
import { authenticate } from '../middleware/authenticate'
import { z } from 'zod'

export default async function clientesRoutes(app: FastifyInstance) {

  // GET /clientes
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { contaId } = request.user as { contaId: string }
    const clientes = await prisma.cliente.findMany({
      where: { contaId, deletedAt: null },
      orderBy: { nome: 'asc' },
    })
    return reply.send(clientes)
  })

  // POST /clientes
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      id: z.string().uuid().optional(),
      nome: z.string().min(1),
      telefone: z.string().optional(),
      fazenda: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const { contaId } = request.user as { contaId: string }
    const { id, ...data } = parsed.data

    const cliente = await prisma.cliente.create({
      data: { ...(id ? { id } : {}), contaId, ...data },
    })
    return reply.status(201).send(cliente)
  })

  // PATCH /clientes/:id
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId } = request.user as { contaId: string }

    const schema = z.object({
      nome: z.string().min(1).optional(),
      telefone: z.string().optional(),
      fazenda: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const cliente = await prisma.cliente.findFirst({ where: { id, contaId, deletedAt: null } })
    if (!cliente) return reply.status(404).send({ error: 'Cliente não encontrado.' })

    const atualizado = await prisma.cliente.update({ where: { id }, data: parsed.data })
    return reply.send(atualizado)
  })

  // DELETE /clientes/:id
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaId } = request.user as { contaId: string }

    const cliente = await prisma.cliente.findFirst({ where: { id, contaId, deletedAt: null } })
    if (!cliente) return reply.status(404).send({ error: 'Cliente não encontrado.' })

    await prisma.cliente.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })
}
