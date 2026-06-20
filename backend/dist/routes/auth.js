"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTelefone = normalizeTelefone;
exports.default = authRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../database"));
const zod_1 = require("zod");
const authenticate_1 = require("../middleware/authenticate");
const sms_1 = require("../services/sms");
// Helper para gerar slug único a partir do nome
function generateSlug(nome) {
    return nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50) + '-' + (0, uuid_1.v4)().substring(0, 6);
}
// Helper para normalizar telefone para formato E.164 (+55XXXXXXXXXXX)
// Aceita: (51) 98182-7578 | 51981827578 | +5551981827578 | 981827578
function normalizeTelefone(telefone) {
    // Remove tudo que não é dígito ou '+'
    let digits = telefone.replace(/[^\d]/g, '');
    // Se tem 8 ou 9 dígitos: só o número local (sem DDD) — improvável mas trata
    if (digits.length <= 9) {
        digits = '55' + digits;
    }
    // Se começa com 55 e tem 12 ou 13 dígitos: já tem código do país
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        return '+' + digits;
    }
    // Se tem 10 ou 11 dígitos: número brasileiro com DDD, sem código de país
    if (digits.length === 10 || digits.length === 11) {
        return '+55' + digits;
    }
    // Fallback: retorna com +55 prefixado
    return '+55' + digits;
}
async function authRoutes(app) {
    const verificationCodes = new Map();
    // ─── POST /auth/send-code ──────────────────────────────────────────────────
    app.post('/send-code', async (request, reply) => {
        const schema = zod_1.z.object({
            telefone: zod_1.z.string().min(8, 'Telefone inválido'),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const telefone = normalizeTelefone(parsed.data.telefone);
        // Verifica se já existe usuário com esse telefone (comparação normalizada)
        const existing = await database_1.default.usuario.findFirst({ where: { telefone } });
        if (existing) {
            return reply.status(409).send({ error: 'Este número de telefone já está cadastrado. Faça login.' });
        }
        // Gera código de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos
        verificationCodes.set(telefone, { code, expiresAt });
        // Envia o SMS
        const success = await sms_1.SmsService.sendVerificationCode(telefone, code);
        if (!success) {
            return reply.status(500).send({ error: 'Erro ao enviar código de verificação por SMS.' });
        }
        return reply.send({ message: 'Código de verificação enviado.' });
    });
    // ─── POST /auth/register ─────────────────────────────────────────────────
    // Cria uma nova Conta (fazenda) e o primeiro usuário (Admin)
    app.post('/register', async (request, reply) => {
        const schema = zod_1.z.object({
            nomeConta: zod_1.z.string().min(2, 'Nome da conta obrigatório'),
            nomeUsuario: zod_1.z.string().min(2, 'Nome obrigatório'),
            telefone: zod_1.z.string().min(8, 'Telefone obrigatório'),
            pin: zod_1.z.string().length(4, 'PIN deve ter exatamente 4 dígitos').regex(/^\d{4}$/, 'PIN deve conter apenas números'),
            code: zod_1.z.string().length(6, 'O código de verificação deve ter 6 dígitos'),
            perfil: zod_1.z.enum(['USO_PROPRIO', 'PRESTADOR']).optional().default('USO_PROPRIO'),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { nomeConta, nomeUsuario, pin, code, perfil } = parsed.data;
        const telefone = normalizeTelefone(parsed.data.telefone);
        // Valida o código de verificação (usa o telefone normalizado como chave)
        const cached = verificationCodes.get(telefone);
        if (!cached || cached.code !== code || cached.expiresAt < Date.now()) {
            return reply.status(400).send({ error: 'Código de verificação inválido ou expirado.' });
        }
        // Limpa o código utilizado
        verificationCodes.delete(telefone);
        // Verifica se já existe usuário com esse telefone
        const existing = await database_1.default.usuario.findFirst({ where: { telefone } });
        if (existing) {
            return reply.status(409).send({ error: 'Já existe uma conta com este número de telefone.' });
        }
        const pinHash = await bcryptjs_1.default.hash(pin, 12);
        const slug = generateSlug(nomeConta);
        const conta = await database_1.default.conta.create({
            data: {
                nome: nomeConta,
                slug,
                perfil,
                usuarios: {
                    create: {
                        nome: nomeUsuario,
                        telefone,
                        pinHash,
                        papel: 'ADMIN',
                    },
                },
            },
            include: { usuarios: true },
        });
        const usuario = conta.usuarios[0];
        const token = app.jwt.sign({
            sub: usuario.id,
            contaId: conta.id,
            papel: usuario.papel,
            nome: usuario.nome,
        });
        return reply.status(201).send({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                telefone: usuario.telefone,
                papel: usuario.papel,
                pinHash: usuario.pinHash,
            },
            conta: {
                id: conta.id,
                nome: conta.nome,
                slug: conta.slug,
                perfil: conta.perfil,
                estoqueMinAlerta: conta.estoqueMinAlerta,
                valorPadraoCon: conta.valorPadraoCon,
                valorPadraoSex: conta.valorPadraoSex,
                whatsappCatalogo: conta.whatsappCatalogo,
            },
        });
    });
    // ─── POST /auth/login ─────────────────────────────────────────────────────
    app.post('/login', async (request, reply) => {
        const schema = zod_1.z.object({
            telefone: zod_1.z.string(),
            pin: zod_1.z.string().length(4),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Telefone e PIN são obrigatórios.' });
        }
        const telefone = normalizeTelefone(parsed.data.telefone);
        const { pin } = parsed.data;
        const usuario = await database_1.default.usuario.findFirst({
            where: { telefone, ativo: true },
            include: { conta: true },
        });
        if (!usuario) {
            return reply.status(401).send({ error: 'Telefone não encontrado.' });
        }
        const pinValido = await bcryptjs_1.default.compare(pin, usuario.pinHash);
        if (!pinValido) {
            return reply.status(401).send({ error: 'PIN incorreto.' });
        }
        const token = app.jwt.sign({
            sub: usuario.id,
            contaId: usuario.contaId,
            papel: usuario.papel,
            nome: usuario.nome,
        });
        return reply.send({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                telefone: usuario.telefone,
                papel: usuario.papel,
                pinHash: usuario.pinHash,
            },
            conta: {
                id: usuario.conta.id,
                nome: usuario.conta.nome,
                slug: usuario.conta.slug,
                perfil: usuario.conta.perfil,
                estoqueMinAlerta: usuario.conta.estoqueMinAlerta,
                valorPadraoCon: usuario.conta.valorPadraoCon,
                valorPadraoSex: usuario.conta.valorPadraoSex,
                whatsappCatalogo: usuario.conta.whatsappCatalogo,
            },
        });
    });
    // ─── POST /auth/invite ────────────────────────────────────────────────────
    // Admin gera um link de convite para novo usuário
    app.post('/invite', {
        preHandler: async (request, reply) => {
            try {
                await request.jwtVerify();
                const user = request.user;
                if (user.papel !== 'ADMIN') {
                    reply.status(403).send({ error: 'Apenas o admin pode convidar usuários.' });
                }
            }
            catch {
                reply.status(401).send({ error: 'Não autorizado.' });
            }
        }
    }, async (request, reply) => {
        const schema = zod_1.z.object({
            nomeConvidado: zod_1.z.string().min(2),
            telefoneConvidado: zod_1.z.string().min(8),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const jwtPayload = request.user;
        const { nomeConvidado, telefoneConvidado } = parsed.data;
        // Verifica se já existe usuário com esse telefone na conta
        const existing = await database_1.default.usuario.findFirst({
            where: { telefone: telefoneConvidado, contaId: jwtPayload.contaId }
        });
        if (existing) {
            return reply.status(409).send({ error: 'Este número já está cadastrado na sua conta.' });
        }
        const inviteToken = (0, uuid_1.v4)();
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
        // Cria usuário inativo (sem PIN) aguardando ativação
        const novoUsuario = await database_1.default.usuario.create({
            data: {
                contaId: jwtPayload.contaId,
                nome: nomeConvidado,
                telefone: telefoneConvidado,
                pinHash: '', // será definido na ativação
                papel: 'USUARIO',
                ativo: false,
                inviteToken,
                inviteExpiresAt,
            },
        });
        const baseUrl = process.env.PUBLIC_URL || 'http://163.176.47.4';
        const inviteLink = `${baseUrl}/convite/${inviteToken}`;
        return reply.status(201).send({
            inviteLink,
            mensagemWhatsapp: `Olá ${nomeConvidado}! Você foi convidado para o AgroSêmen. Clique no link para ativar sua conta: ${inviteLink}`,
            usuario: {
                id: novoUsuario.id,
                nome: novoUsuario.nome,
                telefone: novoUsuario.telefone,
            },
        });
    });
    // ─── POST /auth/activate/:token ───────────────────────────────────────────
    // Usuário convidado ativa a conta definindo seu PIN
    app.post('/activate/:token', async (request, reply) => {
        const { token } = request.params;
        const schema = zod_1.z.object({
            pin: zod_1.z.string().length(4).regex(/^\d{4}$/),
            nome: zod_1.z.string().min(2).optional(), // pode atualizar o nome
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'PIN deve ter 4 dígitos numéricos.' });
        }
        const usuario = await database_1.default.usuario.findUnique({
            where: { inviteToken: token },
            include: { conta: true },
        });
        if (!usuario) {
            return reply.status(404).send({ error: 'Convite inválido ou já utilizado.' });
        }
        if (usuario.inviteExpiresAt && usuario.inviteExpiresAt < new Date()) {
            return reply.status(410).send({ error: 'Este convite expirou. Solicite um novo convite.' });
        }
        const pinHash = await bcryptjs_1.default.hash(parsed.data.pin, 12);
        const usuarioAtualizado = await database_1.default.usuario.update({
            where: { id: usuario.id },
            data: {
                pinHash,
                ativo: true,
                inviteToken: null,
                inviteExpiresAt: null,
                nome: parsed.data.nome || usuario.nome,
            },
        });
        const jwtToken = app.jwt.sign({
            sub: usuarioAtualizado.id,
            contaId: usuario.contaId,
            papel: usuarioAtualizado.papel,
            nome: usuarioAtualizado.nome,
        });
        return reply.send({
            token: jwtToken,
            usuario: {
                id: usuarioAtualizado.id,
                nome: usuarioAtualizado.nome,
                telefone: usuarioAtualizado.telefone,
                papel: usuarioAtualizado.papel,
                pinHash: usuarioAtualizado.pinHash,
            },
            conta: {
                id: usuario.conta.id,
                nome: usuario.conta.nome,
                slug: usuario.conta.slug,
                perfil: usuario.conta.perfil,
                estoqueMinAlerta: usuario.conta.estoqueMinAlerta,
                valorPadraoCon: usuario.conta.valorPadraoCon,
                valorPadraoSex: usuario.conta.valorPadraoSex,
                whatsappCatalogo: usuario.conta.whatsappCatalogo,
            },
        });
    });
    // ─── GET /auth/invite/:token ─────────────────────────────────────────────
    // Consulta informações do convite (para mostrar ao usuário antes de ativar)
    app.get('/invite/:token', async (request, reply) => {
        const { token } = request.params;
        const usuario = await database_1.default.usuario.findUnique({
            where: { inviteToken: token },
            include: { conta: { select: { nome: true, slug: true } } },
        });
        if (!usuario) {
            return reply.status(404).send({ error: 'Convite inválido ou já utilizado.' });
        }
        if (usuario.inviteExpiresAt && usuario.inviteExpiresAt < new Date()) {
            return reply.status(410).send({ error: 'Este convite expirou.' });
        }
        return reply.send({
            nome: usuario.nome,
            telefone: usuario.telefone,
            conta: usuario.conta,
        });
    });
    // ─── POST /auth/refresh ───────────────────────────────────────────────────
    // Retorna um novo token JWT
    app.post('/refresh', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const user = request.user;
        const token = app.jwt.sign({
            sub: user.sub,
            contaId: user.contaId,
            papel: user.papel,
            nome: user.nome,
        });
        return reply.send({ token });
    });
}
//# sourceMappingURL=auth.js.map