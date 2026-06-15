import { FastifyRequest, FastifyReply } from 'fastify'

// Decorator para autenticar requisições via JWT
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Token inválido ou expirado.' })
  }
}

// Decorator para exigir papel de ADMIN
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply)
  const user = request.user as { papel: string }
  if (user?.papel !== 'ADMIN') {
    return reply.status(403).send({ error: 'Acesso restrito ao administrador.' })
  }
}
