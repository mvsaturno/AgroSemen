"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = syncRoutes;
const database_1 = __importDefault(require("../database"));
const authenticate_1 = require("../middleware/authenticate");
const zod_1 = require("zod");
async function syncRoutes(app) {
    // ─── POST /sync ──────────────────────────────────────────────────────────
    // Sincronização bidirecional delta
    // - Recebe registros dirty do cliente (push)
    // - Retorna registros novos/atualizados no servidor desde last_synced_at (pull)
    app.post('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const schema = zod_1.z.object({
            deviceId: zod_1.z.string(),
            lastSyncedAt: zod_1.z.string().optional(), // ISO timestamp ou null (primeira sync)
            push: zod_1.z.object({
                inseminacoes: zod_1.z.array(zod_1.z.any()).optional().default([]),
                touros: zod_1.z.array(zod_1.z.any()).optional().default([]),
                lotes: zod_1.z.array(zod_1.z.any()).optional().default([]),
                clientes: zod_1.z.array(zod_1.z.any()).optional().default([]),
            }).optional().default({}),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Payload de sync inválido.' });
        }
        const { contaId, sub: usuarioId } = request.user;
        const { deviceId, lastSyncedAt, push } = parsed.data;
        const since = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);
        const syncAt = new Date();
        const pushData = push;
        // ── PUSH: aplica registros enviados pelo cliente ──────────────────────
        const errors = [];
        // Touros
        for (const t of pushData.touros || []) {
            try {
                const existente = await database_1.default.touro.findUnique({ where: { id: t.id } });
                if (existente) {
                    if (new Date(t.updatedAt) > existente.updatedAt) {
                        await database_1.default.touro.update({
                            where: { id: t.id },
                            data: {
                                nome: t.nome, codigoRegistro: t.codigoRegistro, raca: t.raca,
                                empresaFornecedora: t.empresaFornecedora, fotoUrl: t.fotoUrl,
                                deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
                            },
                        });
                    }
                }
                else {
                    await database_1.default.touro.create({
                        data: {
                            id: t.id, contaId, nome: t.nome, codigoRegistro: t.codigoRegistro,
                            raca: t.raca, empresaFornecedora: t.empresaFornecedora, fotoUrl: t.fotoUrl,
                            deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
                        },
                    });
                }
            }
            catch (e) {
                errors.push(`Touro ${t.id}: ${e}`);
            }
        }
        // Lotes
        for (const l of pushData.lotes || []) {
            try {
                const existente = await database_1.default.loteSemen.findUnique({ where: { id: l.id } });
                if (existente) {
                    if (new Date(l.updatedAt) > existente.updatedAt) {
                        await database_1.default.loteSemen.update({
                            where: { id: l.id },
                            data: {
                                quantidade: l.quantidade, valorUnitario: l.valorUnitario,
                                codigoPalheta: l.codigoPalheta, caneca: l.caneca, botijao: l.botijao,
                                deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
                            },
                        });
                    }
                }
                else {
                    await database_1.default.loteSemen.create({
                        data: {
                            id: l.id, touroId: l.touroId, contaId, tipo: l.tipo,
                            quantidade: l.quantidade, valorUnitario: l.valorUnitario,
                            codigoPalheta: l.codigoPalheta, caneca: l.caneca, botijao: l.botijao,
                            deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
                        },
                    });
                }
            }
            catch (e) {
                errors.push(`Lote ${l.id}: ${e}`);
            }
        }
        // Clientes
        for (const c of pushData.clientes || []) {
            try {
                const existente = await database_1.default.cliente.findUnique({ where: { id: c.id } });
                if (existente) {
                    if (new Date(c.updatedAt) > existente.updatedAt) {
                        await database_1.default.cliente.update({
                            where: { id: c.id },
                            data: {
                                nome: c.nome, telefone: c.telefone, fazenda: c.fazenda,
                                deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
                            },
                        });
                    }
                }
                else {
                    await database_1.default.cliente.create({
                        data: {
                            id: c.id, contaId, nome: c.nome, telefone: c.telefone,
                            fazenda: c.fazenda, deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
                        },
                    });
                }
            }
            catch (e) {
                errors.push(`Cliente ${c.id}: ${e}`);
            }
        }
        // Inseminações
        for (const i of pushData.inseminacoes || []) {
            try {
                const dataDate = new Date(i.dataInseminacao);
                dataDate.setUTCHours(0, 0, 0, 0);
                const existente = await database_1.default.inseminacao.findUnique({ where: { id: i.id } });
                if (existente) {
                    // Atualiza apenas se o updatedAt do cliente é mais recente
                    if (new Date(i.updatedAt) > existente.updatedAt) {
                        await database_1.default.inseminacao.update({
                            where: { id: i.id },
                            data: {
                                clienteId: i.clienteId,
                                identificacaoVaca: i.identificacaoVaca,
                                valorCobrado: i.valorCobrado,
                                nota: i.nota,
                                dataInseminacao: dataDate,
                                deletedAt: i.deletedAt ? new Date(i.deletedAt) : null,
                                syncedAt: syncAt,
                                isDirty: false,
                            },
                        });
                    }
                }
                else {
                    await database_1.default.inseminacao.create({
                        data: {
                            id: i.id, contaId, usuarioId, touroId: i.touroId,
                            loteSemenId: i.loteSemenId, clienteId: i.clienteId,
                            identificacaoVaca: i.identificacaoVaca, valorCobrado: i.valorCobrado,
                            nota: i.nota, dataInseminacao: dataDate,
                            deletedAt: i.deletedAt ? new Date(i.deletedAt) : null,
                            syncedAt: syncAt, isDirty: false,
                        },
                    });
                    // Decrementa estoque — ignora se o lote ainda não existe no servidor
                    // (pode chegar via sync de lotes em um ciclo posterior)
                    await database_1.default.loteSemen.update({
                        where: { id: i.loteSemenId },
                        data: { quantidade: { decrement: 1 } },
                    }).catch((e) => {
                        app.log.warn(`[sync] Não foi possível decrementar estoque do lote ${i.loteSemenId}: ${e}`);
                    });
                }
            }
            catch (e) {
                errors.push(`Inseminação ${i.id}: ${e}`);
            }
        }
        // ── PULL: retorna delta desde last_synced_at ──────────────────────────
        const [touros, lotes, clientes, inseminacoes] = await Promise.all([
            database_1.default.touro.findMany({
                where: { contaId, updatedAt: { gt: since } },
                include: { lotes: { where: { updatedAt: { gt: since } } } },
            }),
            database_1.default.loteSemen.findMany({
                where: { contaId, updatedAt: { gt: since } },
            }),
            database_1.default.cliente.findMany({
                where: { contaId, updatedAt: { gt: since } },
            }),
            database_1.default.inseminacao.findMany({
                where: { contaId, updatedAt: { gt: since } },
                include: {
                    touro: { select: { nome: true, raca: true } },
                    loteSemen: { select: { tipo: true } },
                    cliente: { select: { nome: true } },
                    usuario: { select: { nome: true } },
                },
            }),
        ]);
        // Atualiza metadata de sync do dispositivo
        await database_1.default.syncMetadata.upsert({
            where: { usuarioId_deviceId: { usuarioId, deviceId } },
            create: { usuarioId, deviceId, lastSyncedAt: syncAt },
            update: { lastSyncedAt: syncAt },
        });
        return reply.send({
            syncedAt: syncAt.toISOString(),
            errors: errors.length > 0 ? errors : undefined,
            pull: { touros, lotes, clientes, inseminacoes },
        });
    });
}
//# sourceMappingURL=sync.js.map