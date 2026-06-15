// Carrega variáveis de ambiente do .env (apenas em desenvolvimento)
import * as dotenv from 'dotenv'
dotenv.config()

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'path'
import fs from 'fs'

// Routes
import authRoutes from './routes/auth'
import tourosRoutes from './routes/touros'
import lotesRoutes from './routes/lotes'
import inseminacoesRoutes from './routes/inseminacoes'
import clientesRoutes from './routes/clientes'
import syncRoutes from './routes/sync'
import catalogoRoutes from './routes/catalogo'
import uploadRoutes from './routes/upload'
import contaRoutes from './routes/conta'

async function main() {
  const PORT = parseInt(process.env.PORT || '3000')
  const HOST = process.env.HOST || '0.0.0.0'
  const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))

  // Garante que o diretório de uploads existe
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }

  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // ─── Plugins ──────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    sign: { expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as string },
  })

  await app.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    },
  })

  await app.register(staticFiles, {
    root: UPLOAD_DIR,
    prefix: '/uploads/',
  })

  // ─── Rotas ────────────────────────────────────────────────────────────────

  // Públicas
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(catalogoRoutes, { prefix: '/catalogo' })

  // Autenticadas (exigem JWT)
  await app.register(uploadRoutes, { prefix: '/upload' })
  await app.register(contaRoutes, { prefix: '/conta' })
  await app.register(tourosRoutes, { prefix: '/touros' })
  await app.register(lotesRoutes, { prefix: '/lotes' })
  await app.register(inseminacoesRoutes, { prefix: '/inseminacoes' })
  await app.register(clientesRoutes, { prefix: '/clientes' })
  await app.register(syncRoutes, { prefix: '/sync' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ─── Start ──────────────────────────────────────────────────────────────────

  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`\n🚀 AgroSemen API rodando em http://${HOST}:${PORT}\n`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
