"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
// Decorator para autenticar requisições via JWT
async function authenticate(request, reply) {
    try {
        await request.jwtVerify();
    }
    catch {
        return reply.status(401).send({ error: 'Token inválido ou expirado.' });
    }
}
// Decorator para exigir papel de ADMIN
async function requireAdmin(request, reply) {
    await authenticate(request, reply);
    const user = request.user;
    if (user?.papel !== 'ADMIN') {
        return reply.status(403).send({ error: 'Acesso restrito ao administrador.' });
    }
}
//# sourceMappingURL=authenticate.js.map