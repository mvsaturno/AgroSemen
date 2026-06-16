"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = clientesRoutes;
const database_1 = __importDefault(require("../database"));
const authenticate_1 = require("../middleware/authenticate");
const zod_1 = require("zod");
async function clientesRoutes(app) {
    // GET /clientes
    app.get('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { contaId } = request.user;
        const clientes = await database_1.default.cliente.findMany({
            where: { contaId, deletedAt: null },
            orderBy: { nome: 'asc' },
        });
        return reply.send(clientes);
    });
    // POST /clientes
    app.post('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const schema = zod_1.z.object({
            id: zod_1.z.string().uuid().optional(),
            nome: zod_1.z.string().min(1),
            telefone: zod_1.z.string().optional(),
            fazenda: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { contaId } = request.user;
        const { id, ...data } = parsed.data;
        const cliente = await database_1.default.cliente.create({
            data: { ...(id ? { id } : {}), contaId, ...data },
        });
        return reply.status(201).send(cliente);
    });
    // PATCH /clientes/:id
    app.patch('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId } = request.user;
        const schema = zod_1.z.object({
            nome: zod_1.z.string().min(1).optional(),
            telefone: zod_1.z.string().optional(),
            fazenda: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const cliente = await database_1.default.cliente.findFirst({ where: { id, contaId, deletedAt: null } });
        if (!cliente)
            return reply.status(404).send({ error: 'Cliente não encontrado.' });
        const atualizado = await database_1.default.cliente.update({ where: { id }, data: parsed.data });
        return reply.send(atualizado);
    });
    // DELETE /clientes/:id
    app.delete('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId } = request.user;
        const cliente = await database_1.default.cliente.findFirst({ where: { id, contaId, deletedAt: null } });
        if (!cliente)
            return reply.status(404).send({ error: 'Cliente não encontrado.' });
        await database_1.default.cliente.update({ where: { id }, data: { deletedAt: new Date() } });
        return reply.status(204).send();
    });
}
//# sourceMappingURL=clientes.js.map