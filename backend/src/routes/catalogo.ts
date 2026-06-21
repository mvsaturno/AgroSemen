
import { FastifyInstance } from 'fastify'
import prisma from '../database'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate'
import { randomBytes } from 'crypto'

export default async function catalogoRoutes(app: FastifyInstance) {

  // ─── POST /catalogo/gerar-link ───────────────────────────────────────────
  app.post('/gerar-link', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string; contaId: string; papel: string }

    const token = randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.linkCatalogo.create({
      data: {
        contaId: user.contaId,
        token,
        expiresAt,
      }
    })

    const baseUrl = process.env.PUBLIC_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '3000'}`
    const link = `${baseUrl}/catalogo/c/${token}`

    return reply.send({ link, token, expiresAt })
  })

  // ─── GET /catalogo/api/:token ───────────────────────────────────────────
  app.get('/api/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    const link = await prisma.linkCatalogo.findUnique({
      where: { token },
      include: { conta: true }
    })

    if (!link || link.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Link expirado ou inválido.' })
    }

    let whatsappDestino = link.conta.whatsappCatalogo
    if (!whatsappDestino) {
      const primeiroUsuario = await prisma.usuario.findFirst({
        where: { contaId: link.contaId, ativo: true },
        orderBy: { papel: 'asc' }
      })
      if (primeiroUsuario) {
        whatsappDestino = primeiroUsuario.telefone
      }
    }

    const touros = await prisma.touro.findMany({
      where: { contaId: link.contaId, deletedAt: null },
      include: {
        lotes: { where: { deletedAt: null } },
        intencoesReserva: { where: { status: 'PENDENTE' } }
      }
    })

    const catalogo = touros.map(t => {
      const saldos = {
        CONVENCIONAL: t.lotes.filter(l => l.tipo === 'CONVENCIONAL').reduce((acc, l) => acc + l.quantidade, 0),
        SEXADO_MACHO: t.lotes.filter(l => l.tipo === 'SEXADO_MACHO').reduce((acc, l) => acc + l.quantidade, 0),
        SEXADO_FEMEA: t.lotes.filter(l => l.tipo === 'SEXADO_FEMEA').reduce((acc, l) => acc + l.quantidade, 0),
      }

      t.intencoesReserva.forEach(r => {
        saldos[r.tipoSemen] -= r.quantidade
      })

      return {
        id: t.id,
        nome: t.nome,
        raca: t.raca,
        codigoRegistro: t.codigoRegistro,
        fotoUrl: t.fotoUrl,
        qtdConvencional: Math.max(0, saldos.CONVENCIONAL),
        qtdMacho: Math.max(0, saldos.SEXADO_MACHO),
        qtdFemea: Math.max(0, saldos.SEXADO_FEMEA),
      }
    }).filter(t => t.qtdConvencional > 0 || t.qtdMacho > 0 || t.qtdFemea > 0)

    return reply.send({
      conta: { nome: link.conta.nome, whatsapp: whatsappDestino },
      touros: catalogo
    })
  })

  // ─── POST /catalogo/api/:token/reservas ─────────────────────────────────
  app.post('/api/:token/reservas', async (request, reply) => {
    const { token } = request.params as { token: string }

    const schema = z.object({
      nomeComprador: z.string().min(1),
      telefoneComprador: z.string().min(1),
      fazendaComprador: z.string().optional(),
      itens: z.array(z.object({
        touroId: z.string().uuid(),
        tipoSemen: z.enum(['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA']),
        quantidade: z.number().int().min(1)
      })).min(1)
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message })

    const link = await prisma.linkCatalogo.findUnique({
      where: { token },
      include: { conta: true }
    })
    if (!link || link.expiresAt < new Date()) return reply.status(401).send({ error: 'Link expirado ou inválido.' })

    const touroIds = parsed.data.itens.map(i => i.touroId)
    const touros = await prisma.touro.findMany({
      where: { id: { in: touroIds }, contaId: link.contaId, deletedAt: null },
      include: {
        lotes: { where: { deletedAt: null } },
        intencoesReserva: { where: { status: 'PENDENTE' } }
      }
    })

    const tourosMap = new Map(touros.map(t => [t.id, t]))
    const errors: string[] = []

    for (const item of parsed.data.itens) {
      const touro = tourosMap.get(item.touroId)
      if (!touro) {
        errors.push(`Touro não encontrado para ID: ${item.touroId}`)
        continue
      }

      let saldo = touro.lotes.filter(l => l.tipo === item.tipoSemen).reduce((acc, l) => acc + l.quantidade, 0)
      touro.intencoesReserva.filter(r => r.tipoSemen === item.tipoSemen).forEach(r => saldo -= r.quantidade)

      if (item.quantidade > saldo) {
        errors.push(`Touro "${touro.nome}" (${item.tipoSemen}): Quantidade solicitada (${item.quantidade}) excede o saldo disponível (${saldo}).`)
      }
    }

    if (errors.length > 0) {
      return reply.status(400).send({ error: 'Saldo de estoque insuficiente para um ou mais itens.', details: errors })
    }

    const fazenda = parsed.data.fazendaComprador?.trim()
    const nomeFinal = fazenda ? `${parsed.data.nomeComprador} (Fazenda: ${fazenda})` : parsed.data.nomeComprador

    const reservasCreated = []
    for (const item of parsed.data.itens) {
      const r = await prisma.intencaoReserva.create({
        data: {
          contaId: link.contaId,
          touroId: item.touroId,
          nomeComprador: nomeFinal,
          telefoneComprador: parsed.data.telefoneComprador,
          tipoSemen: item.tipoSemen,
          quantidade: item.quantidade,
          status: 'PENDENTE'
        }
      })
      reservasCreated.push(r.id)
    }

    const date = new Date()
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const dataExtenso = `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()} às ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

    const tipoLabel: Record<string, string> = {
      CONVENCIONAL: 'Convencional',
      SEXADO_MACHO: 'Sexado ♂ (Macho)',
      SEXADO_FEMEA: 'Sexado ♀ (Fêmea)',
    }

    let itensTexto = ''
    for (const item of parsed.data.itens) {
      const touro = tourosMap.get(item.touroId)!
      itensTexto += `• ${item.quantidade} doses - *${touro.nome}* (${tipoLabel[item.tipoSemen]})\n`
    }

    const fazendaLinha = fazenda ? `*Fazenda:* ${fazenda}\n` : ''

    const mensagemOriginal =
      `*Pedido de Reserva - AgroSêmen*\n` +
      `----------------------------------\n` +
      `*Comprador:* ${parsed.data.nomeComprador}\n` +
      `*WhatsApp:* ${parsed.data.telefoneComprador}\n` +
      `${fazendaLinha}` +
      `*Data:* ${dataExtenso}\n\n` +
      `*Itens do Pedido:*\n` +
      `${itensTexto}` +
      `----------------------------------\n` +
      `_Enviado via Catálogo AgroSêmen_`

    const mensagemUrl = encodeURIComponent(mensagemOriginal)

    let whatsappDestino = link.conta.whatsappCatalogo
    if (!whatsappDestino) {
      const primeiroUsuario = await prisma.usuario.findFirst({
        where: { contaId: link.contaId, ativo: true },
        orderBy: { papel: 'asc' }
      })
      if (primeiroUsuario) {
        whatsappDestino = primeiroUsuario.telefone
      }
    }

    const whatsappUrl = whatsappDestino
      ? `https://wa.me/${whatsappDestino.replace(/\D/g, '')}?text=${mensagemUrl}`
      : null

    return reply.send({
      reservas: reservasCreated,
      whatsappUrl,
      mensagemOriginal
    })
  })

  // ─── GET /catalogo/c/:token ───────────────────────────────────────────
  app.get('/c/:token', async (request, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8')
    const { token } = request.params as { token: string }

    const link = await prisma.linkCatalogo.findUnique({
      where: { token },
      include: { conta: true }
    })

    if (!link || link.expiresAt < new Date()) {
      return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catálogo Expirado - AgroSêmen</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Outfit', 'sans-serif'],
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 font-sans text-slate-800">
  <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 text-center">
    <div class="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100 shadow-sm">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
    </div>
    <h3 class="font-extrabold text-xl text-slate-900 tracking-tight">Catálogo expirado ou inválido</h3>
    <p class="text-sm text-slate-500 mt-2 leading-relaxed">Este catálogo não está mais ativo ou o link expirou (validade de 24 horas). Solicite um novo link ao administrador.</p>
  </div>
</body>
</html>`
    }

    const nomeConta = link.conta.nome;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catálogo de Touros - ${nomeConta} - AgroSêmen</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Outfit', 'sans-serif'],
          },
          colors: {
            primary: {
              50: '#f0fdf4',
              100: '#dcfce7',
              200: '#bbf7d0',
              300: '#86efac',
              400: '#4ade80',
              500: '#22c55e',
              600: '#16a34a',
              700: '#15803d',
              800: '#166534',
              900: '#14532d',
              950: '#052e16',
            },
          }
        }
      }
    }
  </script>
  <style>
    @keyframes bounce-slow {
      0%, 100% { transform: translateY(-5%) scale(1.05); }
      50% { transform: translateY(0) scale(1); }
    }
    .animate-bounce-slow {
      animation: bounce-slow 2s infinite;
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  </style>
</head>
<body class="bg-slate-50 min-h-screen font-sans text-slate-800 selection:bg-primary-100 selection:text-primary-800 pb-12">

  <!-- Sticky Glass Header -->
  <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-primary-200">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
          </svg>
        </div>
        <div>
          <h1 id="header-conta-name" class="font-extrabold text-slate-900 text-base leading-tight tracking-tight">${nomeConta}</h1>
          <p class="text-xs text-slate-500 font-medium">Catálogo de Reprodutores</p>
        </div>
      </div>
      
      <!-- Shopping Bag Button -->
      <button onclick="toggleCart(true)" class="relative p-2.5 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 text-slate-700 hover:text-primary-700 transition-all flex items-center gap-2 group">
        <svg class="w-5.5 h-5.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
        </svg>
        <span class="hidden md:inline font-bold text-sm">Sacola</span>
        <span id="cart-badge" class="absolute -top-1.5 -right-1.5 bg-primary-600 text-white font-bold text-[10px] w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-white scale-0 transition-transform duration-300">0</span>
      </button>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- Hero Banner -->
    <div id="hero-banner" class="mb-8 rounded-3xl overflow-hidden shadow-sm border border-slate-100 bg-gradient-to-tr from-slate-950 to-slate-800 text-white p-6 sm:p-8 relative">
      <div class="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-8 pointer-events-none hidden md:flex">
        <svg class="w-64 h-64 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"></path>
        </svg>
      </div>
      <div class="relative z-10 max-w-xl">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-4">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Catálogo Online
        </span>
        <h2 id="hero-title" class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">Carregando o catálogo de ${nomeConta}...</h2>
        <p class="mt-2 text-slate-300 text-sm sm:text-base">Adicione sêmens de cada reprodutor à sua sacola, preencha seus dados de contato e envie o pedido diretamente via WhatsApp.</p>
        <p class="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Este catálogo expira automaticamente em 24 horas.
        </p>
      </div>
    </div>

    <!-- Bull Catalog List -->
    <div id="catalog-section">
      <div id="bull-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Rendered dynamically -->
      </div>
      
      <!-- Empty State -->
      <div id="empty-state" class="hidden text-center py-16 bg-white rounded-3xl border border-slate-200/80 shadow-sm max-w-md mx-auto px-6">
        <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
          </svg>
        </div>
        <h3 class="font-bold text-lg text-slate-900">Nenhum touro disponível</h3>
        <p class="text-sm text-slate-500 mt-1">No momento todos os reprodutores deste catálogo estão sem doses disponíveis em estoque.</p>
      </div>
    </div>

    <!-- Success View -->
    <div id="success-section" class="hidden max-w-xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-lg p-6 sm:p-8 text-center mt-4">
      <div class="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100 shadow-inner">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      <h2 class="text-2xl font-black text-slate-900 tracking-tight">Pedido Registrado!</h2>
      <p class="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
        Sua intenção de reserva foi cadastrada no sistema. Agora, finalize clicando no botão para enviar os detalhes pelo WhatsApp do fornecedor.
      </p>

      <!-- Read-only Summary text box -->
      <div class="mt-6 text-left">
        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Resumo do Pedido (Formatado para WhatsApp)</span>
        <div class="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto" id="whatsapp-message-preview"></div>
      </div>

      <!-- Action buttons -->
      <div class="mt-8 flex flex-col gap-3">
        <a id="btn-send-whatsapp" target="_blank" href="#" class="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3.5 px-6 rounded-2xl transition shadow-md shadow-green-100 flex items-center justify-center gap-2 text-base">
          <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 11.966.01c3.178.001 6.169 1.24 8.419 3.496 2.25 2.256 3.489 5.242 3.487 8.428-.005 6.618-5.34 11.955-11.91 11.955a11.9 11.9 0 0 1-5.698-1.448zm6.549-2.906c.032.019.262.155.291.171a9.88 9.88 0 0 0 5.071 1.402c5.529 0 10.025-4.484 10.03-10.012.002-2.678-1.041-5.197-2.936-7.096A10.0 10.0 0 0 0 11.97 2.01c-5.527 0-10.02 4.485-10.025 10.013a9.92 9.92 0 0 0 1.527 5.176c.018.03.1.164.081.12l-1.011 3.693 3.792-.99c.04-.01.166.064.225.1a9.8 9.8 0 0 0 5.053 1.396z"/>
          </svg>
          Enviar via WhatsApp
        </a>
        <button onclick="shareOrder()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-2xl transition flex items-center justify-center gap-2 text-base">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 10.742l4.636-2.318m-4.636 2.318l4.636 2.318M7 7h.01M7 17h.01M17 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Compartilhar Pedido
        </button>
        <button onclick="resetCartAndRestart()" class="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-3 px-6 rounded-2xl transition text-sm mt-2">
          Fazer Outro Pedido (Voltar ao Catálogo)
        </button>
      </div>
    </div>
  </main>

  <!-- Sidebar Overlay -->
  <div id="cart-overlay" onclick="toggleCart(false)" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden opacity-0 transition-opacity duration-300"></div>

  <!-- Cart Sidebar -->
  <div id="cart-sidebar" class="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-white z-50 shadow-2xl border-l border-slate-200 translate-x-full transition-transform duration-300 flex flex-col">
    <!-- Header -->
    <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
      <div class="flex items-center gap-2">
        <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
        </svg>
        <h3 class="text-xl font-bold text-slate-900">Sacola de Pedidos</h3>
      </div>
      <button onclick="toggleCart(false)" class="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- Cart items list (Scrollable) -->
    <div id="cart-items" class="flex-1 overflow-y-auto p-6 space-y-4">
      <!-- Items dynamically added -->
    </div>

    <!-- Checkout Footer Form -->
    <div class="p-6 border-t border-slate-100 bg-slate-50/80 space-y-4">
      <div class="flex justify-between items-center text-sm font-semibold text-slate-500">
        <span>Total de Itens:</span>
        <span id="cart-total-items" class="text-base text-slate-900 font-extrabold">0 itens</span>
      </div>
      <div class="flex justify-between items-center text-sm font-semibold text-slate-500">
        <span>Total de Doses:</span>
        <span id="cart-total-doses" class="text-base text-primary-700 font-extrabold">0 doses</span>
      </div>

      <!-- Checkout Form -->
      <div id="checkout-form-container" class="space-y-3 pt-2">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Seu Nome *</label>
          <input type="text" id="buyer-name" class="w-full border border-slate-200 bg-white px-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm focus:outline-none transition-all placeholder:text-slate-400" placeholder="Seu nome completo">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Seu WhatsApp (com DDD) *</label>
          <input type="tel" id="buyer-whatsapp" class="w-full border border-slate-200 bg-white px-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm focus:outline-none transition-all placeholder:text-slate-400" placeholder="Ex: (11) 99999-9999">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Nome da Fazenda (Opcional)</label>
          <input type="text" id="buyer-farm" class="w-full border border-slate-200 bg-white px-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm focus:outline-none transition-all placeholder:text-slate-400" placeholder="Ex: Fazenda Bela Vista">
        </div>
        
        <button id="btn-submit-order" onclick="submitOrder()" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition shadow-md shadow-primary-100 flex items-center justify-center gap-2 mt-4 text-sm">
          Submeter Pedido
        </button>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="toast-container" class="fixed bottom-5 right-5 left-5 sm:left-auto z-[60] space-y-2 pointer-events-none"></div>

  <script>
    const token = '${token}';
    var tourosData = [];
    var cart = [];
    var orderResponse = null;

    function init() {
      console.log('init: Starting initialization...');
      var whatsappInput = document.getElementById('buyer-whatsapp');
      if (whatsappInput) {
        console.log('init: whatsapp input element found.');
        whatsappInput.addEventListener('input', function (e) {
          var v = e.target.value.replace(/[^0-9]/g, '');
          if (v.length > 11) v = v.substring(0, 11);
          
          var formatted = '';
          if (v.length > 0) {
            formatted = '(' + v.substring(0, 2);
            if (v.length > 2) {
              formatted += ') ' + v.substring(2, 7);
              if (v.length > 7) {
                formatted += '-' + v.substring(7, 11);
              }
            }
          }
          e.target.value = formatted;
        });
      } else {
        console.warn('init: whatsapp input element NOT found.');
      }
      console.log('init: calling load()...');
      load();
    }

    console.log('script: script evaluation started. readyState:', document.readyState);
    if (document.readyState === 'loading') {
      console.log('script: DOM still loading, adding DOMContentLoaded listener...');
      document.addEventListener('DOMContentLoaded', init);
    } else {
      console.log('script: DOM ready, calling init() directly...');
      init();
    }

    async function load() {
      console.log('load: Loading catalog...');
      try {
        console.log('load: Fetching API for token:', token);
        var res = await fetch('/catalogo/api/' + token);
        console.log('load: Fetch response received. ok:', res.ok, 'status:', res.status);
        if (!res.ok) {
          var e = await res.json();
          console.error('load: API response not ok:', e);
          document.getElementById('catalog-section').innerHTML = '<div class="p-8 text-center text-red-600 font-bold mt-10 bg-red-50 rounded-xl mx-4 shadow-sm border border-red-100">' + (e.error || 'Erro ao carregar') + '</div>';
          return;
        }
        var data = await res.json();
        console.log('load: JSON parsed successfully:', data);
        tourosData = data.touros;
        
        document.getElementById('header-conta-name').innerText = data.conta.nome;
        document.getElementById('hero-title').innerText = "Escolha sêmen no catálogo de " + data.conta.nome;
        
        var grid = document.getElementById('bull-grid');
        var emptyState = document.getElementById('empty-state');
        
        if (tourosData.length === 0) {
          console.log('load: No bulls available in catalog.');
          grid.innerHTML = '';
          emptyState.classList.remove('hidden');
        } else {
          console.log('load: Rendering', tourosData.length, 'bulls.');
          emptyState.classList.add('hidden');
          grid.innerHTML = tourosData.map(t => renderCard(t)).join('');
        }
        updateCartUI();
        console.log('load: Catalog rendering complete.');
      } catch (err) {
        console.error('load: Error during catalog load:', err);
        document.getElementById('catalog-section').innerHTML = '<div class="p-8 text-center text-red-600 font-bold mt-10 bg-red-50 rounded-xl mx-4 shadow-sm border border-red-100">Erro de conexão ao carregar o catálogo.</div>';
      }
    }

    function renderCard(t) {
      var img = t.fotoUrl && t.fotoUrl.startsWith('http') ? t.fotoUrl : (t.fotoUrl ? '/uploads/' + t.fotoUrl : '');
      var imgHtml = img 
        ? '<img src="' + img + '" class="w-full h-56 object-cover transition-transform duration-500 hover:scale-105">' 
        : '<div class="w-full h-56 bg-gradient-to-tr from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-400"><svg class="w-12 h-12 mb-2 opacity-55" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sem Foto do Touro</span></div>';

      var selectOptions = '';
      var firstAvailableType = '';
      var firstAvailableMax = 0;

      if (t.qtdConvencional > 0) {
        selectOptions += '<option value="CONVENCIONAL">Convencional (' + t.qtdConvencional + ')</option>';
        if (!firstAvailableType) {
          firstAvailableType = 'CONVENCIONAL';
          firstAvailableMax = t.qtdConvencional;
        }
      }
      if (t.qtdMacho > 0) {
        selectOptions += '<option value="SEXADO_MACHO">Sexado Macho (' + t.qtdMacho + ')</option>';
        if (!firstAvailableType) {
          firstAvailableType = 'SEXADO_MACHO';
          firstAvailableMax = t.qtdMacho;
        }
      }
      if (t.qtdFemea > 0) {
        selectOptions += '<option value="SEXADO_FEMEA">Sexado Fêmea (' + t.qtdFemea + ')</option>';
        if (!firstAvailableType) {
          firstAvailableType = 'SEXADO_FEMEA';
          firstAvailableMax = t.qtdFemea;
        }
      }

      var racaVal = t.raca || 'S/ Raça';
      var nomeVal = t.nome;
      var registroVal = t.codigoRegistro || 'Não informado';

      return '<div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-150 hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">' +
        '<div>' +
        '  <div class="relative overflow-hidden bg-slate-100 border-b border-slate-100">' +
        '    ' + imgHtml +
        '    <span class="absolute top-3 right-3 bg-white/95 backdrop-blur-md text-slate-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-slate-200/50 shadow-sm uppercase tracking-wider">' + racaVal + '</span>' +
        '  </div>' +
        '  ' +
        '  <div class="p-5">' +
        '    <h3 class="font-extrabold text-lg text-slate-900 tracking-tight leading-tight">' + nomeVal + '</h3>' +
        '    <p class="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Reg: ' + registroVal + '</p>' +
        '    ' +
        '    <div class="mt-4 space-y-3">' +
        '      <div>' +
        '        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Tipo de Sêmen</label>' +
        '        <select id="type-select-' + t.id + '" onchange="onSemenTypeChange(&quot;' + t.id + '&quot;)" class="w-full border border-slate-200 bg-slate-50/50 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all cursor-pointer">' +
        '          ' + selectOptions +
        '        </select>' +
        '      </div>' +
        '      <div class="flex items-center justify-between gap-4 pt-1">' +
        '        <div>' +
        '          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Quantidade</span>' +
        '          <span id="stock-badge-' + t.id + '" class="text-[11px] text-primary-700 font-bold">' + firstAvailableMax + ' doses disponíveis</span>' +
        '        </div>' +
        '        ' +
        '        <div class="flex items-center border border-slate-200 rounded-xl bg-slate-50/50 p-1">' +
        '          <button onclick="adjustQty(&quot;' + t.id + '&quot;, -1)" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 rounded-lg transition-colors font-extrabold text-base select-none">-</button>' +
        '          <input type="number" id="qty-input-' + t.id + '" value="1" min="1" max="' + firstAvailableMax + '" class="w-10 text-center bg-transparent border-none text-sm font-bold text-slate-800 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" readonly>' +
        '          <button onclick="adjustQty(&quot;' + t.id + '&quot;, 1)" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 rounded-lg transition-colors font-extrabold text-base select-none">+</button>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="px-5 pb-5 pt-2">' +
        '  <button onclick="addItemToCart(&quot;' + t.id + '&quot;)" class="w-full bg-slate-900 hover:bg-primary-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 group hover:shadow-md hover:shadow-primary-100">' +
        '    <svg class="w-4.5 h-4.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
        '      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>' +
        '    </svg>' +
        '    Adicionar à Sacola' +
        '  </button>' +
        '</div>' +
        '</div>';
    }

    function adjustQty(bullId, delta) {
      var input = document.getElementById('qty-input-' + bullId);
      var min = parseInt(input.min, 10) || 1;
      var max = parseInt(input.max, 10) || 999;
      var val = (parseInt(input.value, 10) || 1) + delta;
      if (val < min) val = min;
      if (val > max) val = max;
      input.value = val;
    }

    function onSemenTypeChange(bullId) {
      var select = document.getElementById('type-select-' + bullId);
      var selectedType = select.value;
      var t = tourosData.find(x => x.id === bullId);
      if (!t) return;
      
      var maxStock = 0;
      if (selectedType === 'CONVENCIONAL') maxStock = t.qtdConvencional;
      else if (selectedType === 'SEXADO_MACHO') maxStock = t.qtdMacho;
      else if (selectedType === 'SEXADO_FEMEA') maxStock = t.qtdFemea;
      
      var input = document.getElementById('qty-input-' + bullId);
      input.max = maxStock;
      if (parseInt(input.value, 10) > maxStock) {
        input.value = maxStock;
      }
      
      var badge = document.getElementById('stock-badge-' + bullId);
      badge.innerText = maxStock + ' doses disponíveis';
    }

    function addItemToCart(bullId) {
      var select = document.getElementById('type-select-' + bullId);
      var tipoSemen = select.value;
      var input = document.getElementById('qty-input-' + bullId);
      var quantity = parseInt(input.value, 10) || 1;
      
      var t = tourosData.find(x => x.id === bullId);
      if (!t) return;
      
      var maxStock = 0;
      if (tipoSemen === 'CONVENCIONAL') maxStock = t.qtdConvencional;
      else if (tipoSemen === 'SEXADO_MACHO') maxStock = t.qtdMacho;
      else if (tipoSemen === 'SEXADO_FEMEA') maxStock = t.qtdFemea;
      
      var existingIdx = cart.findIndex(item => item.touroId === bullId && item.tipoSemen === tipoSemen);
      
      if (existingIdx > -1) {
        var newQty = cart[existingIdx].quantidade + quantity;
        if (newQty > maxStock) {
          cart[existingIdx].quantidade = maxStock;
          showToast('Sacola atualizada: limitado ao saldo máximo de ' + maxStock + ' doses.');
        } else {
          cart[existingIdx].quantidade = newQty;
          showToast('Mais ' + quantity + ' doses de ' + t.nome + ' adicionadas!');
        }
      } else {
        cart.push({
          touroId: bullId,
          touroNome: t.nome,
          tipoSemen: tipoSemen,
          quantidade: quantity,
          maxQtd: maxStock
        });
        showToast(t.nome + ' adicionado à sacola!');
      }
      
      input.value = 1;
      updateCartUI();
      
      var badgeEl = document.getElementById('cart-badge');
      badgeEl.classList.add('scale-110');
      setTimeout(() => badgeEl.classList.remove('scale-110'), 300);
    }

    function updateCartUI() {
      var totalDoses = cart.reduce((acc, item) => acc + item.quantidade, 0);
      var totalItems = cart.length;
      
      var badge = document.getElementById('cart-badge');
      badge.innerText = totalDoses;
      if (totalDoses > 0) {
        badge.classList.remove('scale-0');
        badge.classList.add('scale-100');
      } else {
        badge.classList.remove('scale-100');
        badge.classList.add('scale-0');
      }
      
      document.getElementById('cart-total-items').innerText = totalItems + (totalItems === 1 ? ' item' : ' itens');
      document.getElementById('cart-total-doses').innerText = totalDoses + (totalDoses === 1 ? ' dose' : ' doses');
      
      renderCartList();
    }

    function renderCartList() {
      var container = document.getElementById('cart-items');
      if (cart.length === 0) {
        container.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-slate-400 text-center">' +
          '  <svg class="w-12 h-12 mb-3 opacity-40 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>' +
          '  </svg>' +
          '  <p class="text-sm font-bold text-slate-800">Sua sacola está vazia</p>' +
          '  <p class="text-xs text-slate-400 mt-1 max-w-[200px]">Navegue pelo catálogo e adicione sêmens para iniciar.</p>' +
          '</div>';
        return;
      }
      
      var tipoLabel = {
        CONVENCIONAL: 'Convencional',
        SEXADO_MACHO: 'Sexado Macho ♂',
        SEXADO_FEMEA: 'Sexado Fêmea ♀',
      };
      
      var html = '';
      cart.forEach((item, idx) => {
        html += '<div class="flex items-center justify-between bg-slate-50 border border-slate-200/60 p-4 rounded-2xl gap-3">' +
          '  <div class="flex-1 min-w-0">' +
          '    <h4 class="font-extrabold text-sm text-slate-900 truncate">' + item.touroNome + '</h4>' +
          '    <p class="text-[11px] text-slate-500 font-bold">' + tipoLabel[item.tipoSemen] + '</p>' +
          '    <div class="text-[10px] text-slate-400 font-medium mt-1">Limite: ' + item.maxQtd + ' doses</div>' +
          '  </div>' +
          '  ' +
          '  <div class="flex items-center gap-2">' +
          '    <div class="flex items-center border border-slate-200 rounded-xl bg-white p-0.5 shadow-sm">' +
          '      <button onclick="adjustCartItemQty(' + idx + ', -1)" class="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded transition font-bold text-xs select-none">-</button>' +
          '      <input type="number" value="' + item.quantidade + '" class="w-8 text-center bg-transparent border-none text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" readonly>' +
          '      <button onclick="adjustCartItemQty(' + idx + ', 1)" class="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded transition font-bold text-xs select-none">+</button>' +
          '    </div>' +
          '    ' +
          '    <button onclick="removeCartItem(' + idx + ')" class="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">' +
          '      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>' +
          '      </svg>' +
          '    </button>' +
          '  </div>' +
          '</div>';
      });
      
      container.innerHTML = html;
    }

    function adjustCartItemQty(index, delta) {
      var item = cart[index];
      if (!item) return;
      
      var newVal = item.quantidade + delta;
      if (newVal < 1) return;
      if (newVal > item.maxQtd) {
        showToast('Limite de estoque atingido para este lote.');
        return;
      }
      item.quantidade = newVal;
      updateCartUI();
    }

    function removeCartItem(index) {
      var name = cart[index].touroNome;
      cart.splice(parseInt(index, 10), 1);
      updateCartUI();
      showToast(name + ' removido da sacola.');
    }

    function toggleCart(isOpen) {
      var sidebar = document.getElementById('cart-sidebar');
      var overlay = document.getElementById('cart-overlay');
      
      if (isOpen) {
        overlay.classList.remove('hidden');
        sidebar.classList.remove('translate-x-full');
        setTimeout(() => {
          overlay.classList.add('opacity-100');
        }, 10);
      } else {
        overlay.classList.remove('opacity-100');
        sidebar.classList.add('translate-x-full');
        setTimeout(() => {
          overlay.classList.add('hidden');
        }, 300);
      }
    }

    function showToast(message) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = "bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-slate-800 pointer-events-auto transform translate-y-4 opacity-0 transition-all duration-300";
      
      toast.innerHTML = '<span>' + message + '</span>' +
        '<button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white font-bold ml-1">✕</button>';
      
      container.appendChild(toast);
      
      setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
      }, 10);
      
      setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    async function submitOrder() {
      if (cart.length === 0) {
        return showToast('Adicione pelo menos um item na sacola.');
      }
      
      var name = document.getElementById('buyer-name').value.trim();
      var whatsapp = document.getElementById('buyer-whatsapp').value.trim();
      var farm = document.getElementById('buyer-farm').value.trim();
      
      if (!name) {
        return showToast('Por favor, preencha seu nome.');
      }
      if (!whatsapp) {
        return showToast('Por favor, preencha seu WhatsApp.');
      }
      
      var btn = document.getElementById('btn-submit-order');
      var originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">' +
        '  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
        '  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
        '</svg>' +
        'Processando Pedido...';
      
      try {
        var payload = {
          nomeComprador: name,
          telefoneComprador: whatsapp,
          itens: cart.map(item => ({
            touroId: item.touroId,
            tipoSemen: item.tipoSemen,
            quantidade: item.quantidade
          }))
        };
        if (farm) {
          payload.fazendaComprador = farm;
        }
        
        var res = await fetch('/catalogo/api/' + token + '/reservas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        var data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Erro ao processar reserva.');
          btn.disabled = false;
          btn.innerHTML = originalText;
          return;
        }
        
        orderResponse = data;
        toggleCart(false);
        showSuccessScreen(data);
        
        if (data.whatsappUrl) {
          window.open(data.whatsappUrl, '_blank');
        }
        
      } catch (err) {
        showToast('Erro de conexão ao enviar pedido.');
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }

    function showSuccessScreen(data) {
      document.getElementById('catalog-section').classList.add('hidden');
      document.getElementById('hero-banner').classList.add('hidden');
      
      var successSection = document.getElementById('success-section');
      successSection.classList.remove('hidden');
      
      document.getElementById('whatsapp-message-preview').innerText = data.mensagemOriginal;
      
      var btnWhatsapp = document.getElementById('btn-send-whatsapp');
      if (data.whatsappUrl) {
        btnWhatsapp.href = data.whatsappUrl;
        btnWhatsapp.classList.remove('pointer-events-none', 'opacity-50');
      } else {
        btnWhatsapp.href = "#";
        btnWhatsapp.classList.add('pointer-events-none', 'opacity-50');
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function shareOrder() {
      if (!orderResponse || !orderResponse.mensagemOriginal) return;
      
      var text = orderResponse.mensagemOriginal;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Pedido de Reserva - AgroSêmen',
            text: text
          });
          showToast('Pedido compartilhado com sucesso!');
        } catch (err) {
          copyToClipboard(text);
        }
      } else {
        copyToClipboard(text);
      }
    }

    function copyToClipboard(text) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast('Copiado para a área de transferência!');
      } catch (err) {
        showToast('Não foi possível copiar automaticamente.');
      }
      document.body.removeChild(textarea);
    }

    function resetCartAndRestart() {
      cart = [];
      updateCartUI();
      orderResponse = null;
      
      document.getElementById('success-section').classList.add('hidden');
      document.getElementById('catalog-section').classList.remove('hidden');
      document.getElementById('hero-banner').classList.remove('hidden');
      
      load();
    }
  </script>
</body>
</html>`
  })
}
