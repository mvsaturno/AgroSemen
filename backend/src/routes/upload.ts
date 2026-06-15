import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://163.176.47.4'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default async function uploadRoutes(app: FastifyInstance) {

  // ─── POST /upload ─────────────────────────────────────────────────────────
  // Upload de foto de touro (multipart/form-data)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const data = await request.file()

    if (!data) {
      return reply.status(400).send({ error: 'Nenhum arquivo enviado.' })
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Formato inválido. Use JPG, PNG ou WebP.' })
    }

    const ext = data.filename.split('.').pop() || 'jpg'
    const filename = `${uuidv4()}.${ext}`
    const filepath = path.join(UPLOAD_DIR, filename)

    // Garante que o diretório existe
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })

    const writeStream = fs.createWriteStream(filepath)
    await new Promise<void>((resolve, reject) => {
      data.file.pipe(writeStream)
      data.file.on('end', resolve)
      data.file.on('error', reject)
    })

    const url = `${PUBLIC_URL}/uploads/${filename}`

    return reply.status(201).send({ url, filename })
  })
}
