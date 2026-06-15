import { FastifyInstance } from 'fastify'
import prisma from '../database'
import { z } from 'zod'

export default async function catalogoRoutes(app: FastifyInstance) {

  // ─── GET /catalogo/:slug ──────────────────────────────────────────────────
  // Rota pública — retorna touros disponíveis (sem dados financeiros)
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const conta = await prisma.conta.findUnique({
      where: { slug },
      select: {
        id: true,
        nome: true,
        whatsappCatalogo: true,
      },
    })

    if (!conta) {
      return reply.status(404).send({ error: 'Catálogo não encontrado.' })
    }

    // Retorna apenas touros com pelo menos 1 dose em estoque
    const touros = await prisma.touro.findMany({
      where: {
        contaId: conta.id,
        deletedAt: null,
        lotes: {
          some: { quantidade: { gt: 0 }, deletedAt: null },
        },
      },
      select: {
        id: true,
        nome: true,
        codigoRegistro: true,
        raca: true,
        fotoUrl: true,
        lotes: {
          where: { quantidade: { gt: 0 }, deletedAt: null },
          select: {
            id: true,
            tipo: true,
            // SEM quantidade exata, SEM valorUnitario (dados internos)
          },
        },
      },
      orderBy: [{ raca: 'asc' }, { nome: 'asc' }],
    })

    return reply.send({
      conta: {
        nome: conta.nome,
        whatsapp: conta.whatsappCatalogo,
      },
      touros,
    })
  })

  // ─── POST /catalogo/:slug/reservas ────────────────────────────────────────
  // Rota pública — registra intenção de reserva e direciona ao WhatsApp
  app.post('/:slug/reservas', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const schema = z.object({
      touroId: z.string().uuid(),
      tipoSemen: z.enum(['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA']),
      nomeComprador: z.string().min(1),
      telefoneComprador: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }

    const conta = await prisma.conta.findUnique({
      where: { slug },
      select: { id: true, whatsappCatalogo: true },
    })

    if (!conta) {
      return reply.status(404).send({ error: 'Catálogo não encontrado.' })
    }

    const touro = await prisma.touro.findFirst({
      where: { id: parsed.data.touroId, contaId: conta.id, deletedAt: null },
    })

    if (!touro) {
      return reply.status(404).send({ error: 'Touro não encontrado.' })
    }

    // Salva a intenção de reserva
    const reserva = await prisma.intencaoReserva.create({
      data: {
        contaId: conta.id,
        touroId: touro.id,
        nomeComprador: parsed.data.nomeComprador,
        telefoneComprador: parsed.data.telefoneComprador,
        tipoSemen: parsed.data.tipoSemen,
        status: 'PENDENTE',
      },
    })

    // Monta a mensagem de WhatsApp
    const tipoLabel: Record<string, string> = {
      CONVENCIONAL: 'Convencional',
      SEXADO_MACHO: 'Sexado ♂ (Macho)',
      SEXADO_FEMEA: 'Sexado ♀ (Fêmea)',
    }

    const mensagem = encodeURIComponent(
      `Olá! Gostaria de reservar o touro *${touro.nome}* (${touro.raca} - cód. ${touro.codigoRegistro || touro.nome})\n` +
      `Tipo de sêmen: ${tipoLabel[parsed.data.tipoSemen]}\n` +
      `Meu nome: ${parsed.data.nomeComprador}`
    )

    const whatsappUrl = conta.whatsappCatalogo
      ? `https://wa.me/${conta.whatsappCatalogo.replace(/\D/g, '')}?text=${mensagem}`
      : null

    return reply.status(201).send({
      reserva: { id: reserva.id, status: reserva.status },
      whatsappUrl,
    })
  })
}
