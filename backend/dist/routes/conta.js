"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = contaRoutes;
const zod_1 = require("zod");
const authenticate_1 = require("../middleware/authenticate");
const database_1 = __importDefault(require("../database"));
async function contaRoutes(app) {
    // Aplicar middleware de autenticação em todas as rotas de conta
    app.addHook('preHandler', authenticate_1.authenticate);
    // ─── PUT /conta/perfil ─────────────────────────────────────────────────────
    // Altera o perfil da conta (Apenas Admin)
    app.put('/perfil', async (request, reply) => {
        const user = request.user;
        if (user.papel !== 'ADMIN') {
            return reply.status(403).send({ error: 'Apenas o administrador da conta pode alterar o perfil.' });
        }
        const schema = zod_1.z.object({
            perfil: zod_1.z.enum(['USO_PROPRIO', 'PRESTADOR']),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const contaAtualizada = await database_1.default.conta.update({
            where: { id: user.contaId },
            data: { perfil: parsed.data.perfil },
        });
        return reply.send({
            message: 'Perfil atualizado com sucesso.',
            conta: {
                id: contaAtualizada.id,
                nome: contaAtualizada.nome,
                slug: contaAtualizada.slug,
                perfil: contaAtualizada.perfil,
                estoqueMinAlerta: contaAtualizada.estoqueMinAlerta,
                valorPadraoCon: contaAtualizada.valorPadraoCon,
                valorPadraoSex: contaAtualizada.valorPadraoSex,
                whatsappCatalogo: contaAtualizada.whatsappCatalogo,
            }
        });
    });
    // ─── PATCH /conta/settings ─────────────────────────────────────────────────
    // Atualiza configurações gerais da conta: estoqueMinAlerta, whatsapp, valores padrão
    // Apenas Admin pode alterar
    app.patch('/settings', async (request, reply) => {
        const user = request.user;
        if (user.papel !== 'ADMIN') {
            return reply.status(403).send({ error: 'Apenas o administrador da conta pode alterar as configurações.' });
        }
        const schema = zod_1.z.object({
            estoqueMinAlerta: zod_1.z.number().int().min(0).optional(),
            whatsappCatalogo: zod_1.z.string().optional().nullable(),
            valorPadraoCon: zod_1.z.number().min(0).optional(),
            valorPadraoSex: zod_1.z.number().min(0).optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        // Monta apenas os campos enviados para não sobrescrever o restante com undefined
        const data = {};
        if (parsed.data.estoqueMinAlerta !== undefined)
            data.estoqueMinAlerta = parsed.data.estoqueMinAlerta;
        if (parsed.data.whatsappCatalogo !== undefined)
            data.whatsappCatalogo = parsed.data.whatsappCatalogo;
        if (parsed.data.valorPadraoCon !== undefined)
            data.valorPadraoCon = parsed.data.valorPadraoCon;
        if (parsed.data.valorPadraoSex !== undefined)
            data.valorPadraoSex = parsed.data.valorPadraoSex;
        if (Object.keys(data).length === 0) {
            return reply.status(400).send({ error: 'Nenhum campo para atualizar.' });
        }
        const contaAtualizada = await database_1.default.conta.update({
            where: { id: user.contaId },
            data,
        });
        return reply.send({
            message: 'Configurações atualizadas com sucesso.',
            conta: {
                id: contaAtualizada.id,
                nome: contaAtualizada.nome,
                slug: contaAtualizada.slug,
                perfil: contaAtualizada.perfil,
                estoqueMinAlerta: contaAtualizada.estoqueMinAlerta,
                valorPadraoCon: contaAtualizada.valorPadraoCon,
                valorPadraoSex: contaAtualizada.valorPadraoSex,
                whatsappCatalogo: contaAtualizada.whatsappCatalogo,
            }
        });
    });
}
//# sourceMappingURL=conta.js.map