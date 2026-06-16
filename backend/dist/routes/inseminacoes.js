"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = inseminacoesRoutes;
const database_1 = __importDefault(require("../database"));
const authenticate_1 = require("../middleware/authenticate");
const zod_1 = require("zod");
async function inseminacoesRoutes(app) {
    // ─── GET /inseminacoes ────────────────────────────────────────────────────
    app.get('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { contaId } = request.user;
        const query = zod_1.z.object({
            de: zod_1.z.string().optional(), // data inicial YYYY-MM-DD
            ate: zod_1.z.string().optional(), // data final YYYY-MM-DD
            clienteId: zod_1.z.string().optional(),
            touroId: zod_1.z.string().optional(),
        });
        const q = query.parse(request.query);
        const inseminacoes = await database_1.default.inseminacao.findMany({
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
        });
        return reply.send(inseminacoes);
    });
    // ─── POST /inseminacoes ───────────────────────────────────────────────────
    app.post('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const schema = zod_1.z.object({
            id: zod_1.z.string().uuid().optional(), // UUID gerado offline
            touroId: zod_1.z.string().uuid(),
            loteSemenId: zod_1.z.string().uuid(),
            clienteId: zod_1.z.string().uuid().optional().nullable(),
            identificacaoVaca: zod_1.z.string().optional(),
            valorCobrado: zod_1.z.number().optional().nullable(),
            nota: zod_1.z.string().optional(),
            dataInseminacao: zod_1.z.string(), // ISO date string
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { contaId, sub: usuarioId } = request.user;
        const { id, dataInseminacao, ...data } = parsed.data;
        // Normaliza a data para 00:00h UTC
        const dataDate = new Date(dataInseminacao);
        dataDate.setUTCHours(0, 0, 0, 0);
        // Verifica se o lote pertence à conta e tem saldo
        const lote = await database_1.default.loteSemen.findFirst({
            where: { id: data.loteSemenId, contaId, deletedAt: null },
        });
        if (!lote)
            return reply.status(404).send({ error: 'Lote de sêmen não encontrado.' });
        if (lote.quantidade < 1)
            return reply.status(400).send({ error: 'Estoque insuficiente para este lote.' });
        // Cria inseminação e decrementa estoque em transação
        const [inseminacao] = await database_1.default.$transaction([
            database_1.default.inseminacao.create({
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
            database_1.default.loteSemen.update({
                where: { id: data.loteSemenId },
                data: { quantidade: { decrement: 1 } },
            }),
        ]);
        return reply.status(201).send(inseminacao);
    });
    // ─── PATCH /inseminacoes/:id ──────────────────────────────────────────────
    app.patch('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId, sub: usuarioId, papel } = request.user;
        const schema = zod_1.z.object({
            clienteId: zod_1.z.string().uuid().optional().nullable(),
            identificacaoVaca: zod_1.z.string().optional(),
            valorCobrado: zod_1.z.number().optional().nullable(),
            nota: zod_1.z.string().optional(),
            dataInseminacao: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const inseminacao = await database_1.default.inseminacao.findFirst({
            where: { id, contaId, deletedAt: null }
        });
        if (!inseminacao)
            return reply.status(404).send({ error: 'Inseminação não encontrada.' });
        // Usuário só pode editar seus próprios registros; Admin pode editar qualquer um
        if (papel !== 'ADMIN' && inseminacao.usuarioId !== usuarioId) {
            return reply.status(403).send({ error: 'Você só pode editar seus próprios registros.' });
        }
        const updateData = { ...parsed.data };
        if (parsed.data.dataInseminacao) {
            const d = new Date(parsed.data.dataInseminacao);
            d.setUTCHours(0, 0, 0, 0);
            updateData.dataInseminacao = d;
        }
        const atualizado = await database_1.default.inseminacao.update({
            where: { id },
            data: updateData,
            include: {
                touro: { select: { nome: true, raca: true } },
                loteSemen: { select: { tipo: true } },
                cliente: { select: { nome: true } },
            },
        });
        return reply.send(atualizado);
    });
    // ─── DELETE /inseminacoes/:id ─────────────────────────────────────────────
    app.delete('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId, sub: usuarioId, papel } = request.user;
        const inseminacao = await database_1.default.inseminacao.findFirst({
            where: { id, contaId, deletedAt: null }
        });
        if (!inseminacao)
            return reply.status(404).send({ error: 'Inseminação não encontrada.' });
        if (papel !== 'ADMIN' && inseminacao.usuarioId !== usuarioId) {
            return reply.status(403).send({ error: 'Você só pode excluir seus próprios registros.' });
        }
        // Soft delete + restaura o estoque
        await database_1.default.$transaction([
            database_1.default.inseminacao.update({ where: { id }, data: { deletedAt: new Date() } }),
            database_1.default.loteSemen.update({
                where: { id: inseminacao.loteSemenId },
                data: { quantidade: { increment: 1 } },
            }),
        ]);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=inseminacoes.js.map