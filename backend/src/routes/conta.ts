import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate'
import prisma from '../database'

export default async function contaRoutes(app: FastifyInstance) {
  // Aplicar middleware de autenticação em todas as rotas de conta
  app.addHook('preHandler', authenticate)

  // ─── PUT /conta/perfil ─────────────────────────────────────────────────────
  // Altera o perfil da conta (Apenas Admin)
  app.put('/perfil', async (request, reply) => {
    const user = request.user as { sub: string; contaId: string; papel: string }
    
    if (user.papel !== 'ADMIN') {
      return reply.status(403).send({ error: 'Apenas o administrador da conta pode alterar o perfil.' })
    }

    const schema = z.object({
      perfil: z.enum(['USO_PROPRIO', 'PRESTADOR']),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const contaAtualizada = await prisma.conta.update({
      where: { id: user.contaId },
      data: { perfil: parsed.data.perfil },
    })

    return reply.send({
      message: 'Perfil atualizado com sucesso.',
      conta: {
        id: contaAtualizada.id,
        nome: contaAtualizada.nome,
        slug: contaAtualizada.slug,
        perfil: contaAtualizada.perfil,
        estoqueMinAlerta: contaAtualizada.estoqueMinAlerta,
        valorPadraoCon: contaAtualizada.valorPadraoCon,
        valorPadraoSex: contaAtualizada.valorPadraoSex,
        whatsappCatalogo: contaAtualizada.whatsappCatalogo,
      }
    })
  })

  // ─── PATCH /conta/settings ─────────────────────────────────────────────────
  // Atualiza configurações gerais da conta: estoqueMinAlerta, whatsapp, valores padrão
  // Apenas Admin pode alterar
  app.patch('/settings', async (request, reply) => {
    const user = request.user as { sub: string; contaId: string; papel: string }

    if (user.papel !== 'ADMIN') {
      return reply.status(403).send({ error: 'Apenas o administrador da conta pode alterar as configurações.' })
    }

    const schema = z.object({
      estoqueMinAlerta: z.number().int().min(0).optional(),
      whatsappCatalogo: z.string().optional().nullable(),
      valorPadraoCon: z.number().min(0).optional(),
      valorPadraoSex: z.number().min(0).optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    // Monta apenas os campos enviados para não sobrescrever o restante com undefined
    const data: Record<string, unknown> = {}
    if (parsed.data.estoqueMinAlerta !== undefined) data.estoqueMinAlerta = parsed.data.estoqueMinAlerta
    if (parsed.data.whatsappCatalogo !== undefined) data.whatsappCatalogo = parsed.data.whatsappCatalogo
    if (parsed.data.valorPadraoCon !== undefined) data.valorPadraoCon = parsed.data.valorPadraoCon
    if (parsed.data.valorPadraoSex !== undefined) data.valorPadraoSex = parsed.data.valorPadraoSex

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })
    }

    const contaAtualizada = await prisma.conta.update({
      where: { id: user.contaId },
      data,
    })

    return reply.send({
      message: 'Configurações atualizadas com sucesso.',
      conta: {
        id: contaAtualizada.id,
        nome: contaAtualizada.nome,
        slug: contaAtualizada.slug,
        perfil: contaAtualizada.perfil,
        estoqueMinAlerta: contaAtualizada.estoqueMinAlerta,
        valorPadraoCon: contaAtualizada.valorPadraoCon,
        valorPadraoSex: contaAtualizada.valorPadraoSex,
        whatsappCatalogo: contaAtualizada.whatsappCatalogo,
      }
    })
  })
}
