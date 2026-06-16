"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = lotesRoutes;
const database_1 = __importDefault(require("../database"));
const authenticate_1 = require("../middleware/authenticate");
const zod_1 = require("zod");
async function lotesRoutes(app) {
    // ─── POST /lotes ──────────────────────────────────────────────────────────
    // Adiciona ou atualiza lote de sêmen para touro existente (entrada de estoque)
    app.post('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const schema = zod_1.z.object({
            id: zod_1.z.string().uuid().optional(),
            touroId: zod_1.z.string().uuid(),
            tipo: zod_1.z.enum(['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA']),
            quantidade: zod_1.z.number().int().min(1),
            valorUnitario: zod_1.z.number().min(0),
            codigoPalheta: zod_1.z.string().optional(),
            caneca: zod_1.z.string().optional(),
            botijao: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { contaId } = request.user;
        const { id, touroId, ...loteData } = parsed.data;
        // Verifica se o touro pertence à conta
        const touro = await database_1.default.touro.findFirst({ where: { id: touroId, contaId, deletedAt: null } });
        if (!touro)
            return reply.status(404).send({ error: 'Touro não encontrado.' });
        // Verifica se já existe lote do mesmo tipo para este touro
        const loteExistente = await database_1.default.loteSemen.findFirst({
            where: { touroId, tipo: loteData.tipo, contaId, deletedAt: null },
        });
        let lote;
        if (loteExistente) {
            // Incrementa o estoque existente
            lote = await database_1.default.loteSemen.update({
                where: { id: loteExistente.id },
                data: {
                    quantidade: { increment: loteData.quantidade },
                    valorUnitario: loteData.valorUnitario,
                    codigoPalheta: loteData.codigoPalheta ?? loteExistente.codigoPalheta,
                    caneca: loteData.caneca ?? loteExistente.caneca,
                    botijao: loteData.botijao ?? loteExistente.botijao,
                },
            });
        }
        else {
            lote = await database_1.default.loteSemen.create({
                data: {
                    ...(id ? { id } : {}),
                    touroId,
                    contaId,
                    ...loteData,
                },
            });
        }
        return reply.status(201).send(lote);
    });
    // ─── PATCH /lotes/:id ─────────────────────────────────────────────────────
    app.patch('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId } = request.user;
        const schema = zod_1.z.object({
            quantidade: zod_1.z.number().int().min(0).optional(),
            valorUnitario: zod_1.z.number().min(0).optional(),
            codigoPalheta: zod_1.z.string().optional(),
            caneca: zod_1.z.string().optional(),
            botijao: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const lote = await database_1.default.loteSemen.findFirst({ where: { id, contaId, deletedAt: null } });
        if (!lote)
            return reply.status(404).send({ error: 'Lote não encontrado.' });
        const atualizado = await database_1.default.loteSemen.update({
            where: { id },
            data: parsed.data,
        });
        return reply.send(atualizado);
    });
    // ─── DELETE /lotes/:id ────────────────────────────────────────────────────
    app.delete('/:id', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { contaId, papel } = request.user;
        if (papel !== 'ADMIN') {
            return reply.status(403).send({ error: 'Apenas o admin pode excluir lotes.' });
        }
        const lote = await database_1.default.loteSemen.findFirst({ where: { id, contaId, deletedAt: null } });
        if (!lote)
            return reply.status(404).send({ error: 'Lote não encontrado.' });
        await database_1.default.loteSemen.update({ where: { id }, data: { deletedAt: new Date() } });
        return reply.status(204).send();
    });
}
//# sourceMappingURL=lotes.js.map