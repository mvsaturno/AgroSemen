"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tourosRoutes;
const database_1 = __importDefault(require("../database"));
const authenticate_1 = require("../middleware/authenticate");
const zod_1 = require("zod");
async function tourosRoutes(app) {
    // ─── GET /touros ──────────────────────────────────────────────────────────
    // Lista todos os touros da conta com saldo calculado por tipo de sêmen
    app.get('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { contaId } = request.user;
        const touros = await database_1.default.touro.findMany({
            where: { contaId, deletedAt: null },
            include: {
                lotes: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        tipo: true,
                        quantidade: true,
                        valorUnitario: true,
                        codigoPalheta: true,
                        caneca: true,
                        botijao: true,
                        updatedAt: true,
                    },
                    orderBy: { tipo: 'asc' },
                },
            },
            orderBy: [{ raca: 'asc' }, { nome: 'asc' }],
        });
        return reply.send(touros);
    });
    // ─── POST /touros ─────────────────────────────────────────────────────────
    app.post('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const schema = zod_1.z.object({
            id: zod_1.z.string().uuid().optional(), // UUID gerado no client (offline)
            nome: zod_1.z.string().min(1),
            codigoRegistro: zod_1.z.string().optional(),
            raca: zod_1.z.string().min(1),
            empresaFornecedora: zod_1.z.string().optional(),
            fotoUrl: zod_1.z.string().optional(),
            lotes: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string().uuid().optional(),
                tipo: zod_1.z.enum(['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA']),
                quantidade: zod_1.z.number().int().min(0),
                valorUnitario: zod_1.z.number().min(0),
                codigoPalheta: zod_1.z.string().optional(),
                caneca: zod_1.z.string().optional(),
                botijao: zod_1.z.string().optional(),
            })).optional().default([]),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { contaId } = request.user;
        const { id, lotes, ...touroData } = parsed.data;
        const touro = await database_1.default.touro.create({
            data: {
                ...(id ? { id } : {}),
                ...touroData,
                contaId,
                lotes: {
                    create: lotes
                        .filter(l => l.quantidade > 0 || l.codigoPalheta)
                        .map(l => ({
                        ...(l.id ? { id: l.id } : {}),
                        contaId,
                        tipo: l.tipo,
                        quantidade: l.quantidade,
                        valorUnitario: l.valorUnitario,
                        codigoPalheta: l.codigoPalheta,
                        caneca: l.caneca,
                        botijao: l.botijao,
                    })),
                },
            },
            include: { lotes: { where: { deletedAt: null } } },
        });
        return reply.status(201).send(touro);
    });
    // ─── PATCH /touros/:id ────────────────────────────────────────────────────
    app.patch('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId } = request.user;
        const schema = zod_1.z.object({
            nome: zod_1.z.string().min(1).optional(),
            codigoRegistro: zod_1.z.string().optional(),
            raca: zod_1.z.string().optional(),
            empresaFornecedora: zod_1.z.string().optional(),
            fotoUrl: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const touro = await database_1.default.touro.findFirst({ where: { id, contaId, deletedAt: null } });
        if (!touro)
            return reply.status(404).send({ error: 'Touro não encontrado.' });
        const atualizado = await database_1.default.touro.update({
            where: { id },
            data: parsed.data,
            include: { lotes: { where: { deletedAt: null } } },
        });
        return reply.send(atualizado);
    });
    // ─── DELETE /touros/:id ───────────────────────────────────────────────────
    app.delete('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId, papel } = request.user;
        if (papel !== 'ADMIN') {
            return reply.status(403).send({ error: 'Apenas o admin pode excluir touros.' });
        }
        const touro = await database_1.default.touro.findFirst({ where: { id, contaId, deletedAt: null } });
        if (!touro)
            return reply.status(404).send({ error: 'Touro não encontrado.' });
        // Soft delete no touro e em todos os lotes
        await database_1.default.$transaction([
            database_1.default.touro.update({ where: { id }, data: { deletedAt: new Date() } }),
            database_1.default.loteSemen.updateMany({ where: { touroId: id }, data: { deletedAt: new Date() } }),
        ]);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=touros.js.map