"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Carrega variáveis de ambiente do .env (apenas em desenvolvimento)
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const static_1 = __importDefault(require("@fastify/static"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const touros_1 = __importDefault(require("./routes/touros"));
const lotes_1 = __importDefault(require("./routes/lotes"));
const inseminacoes_1 = __importDefault(require("./routes/inseminacoes"));
const clientes_1 = __importDefault(require("./routes/clientes"));
const sync_1 = __importDefault(require("./routes/sync"));
const catalogo_1 = __importDefault(require("./routes/catalogo"));
const upload_1 = __importDefault(require("./routes/upload"));
const conta_1 = __importDefault(require("./routes/conta"));
async function main() {
    const PORT = parseInt(process.env.PORT || '3000');
    const HOST = process.env.HOST || '0.0.0.0';
    const UPLOAD_DIR = path_1.default.resolve(process.env.UPLOAD_DIR || path_1.default.join(process.cwd(), 'uploads'));
    // Garante que o diretório de uploads existe
    if (!fs_1.default.existsSync(UPLOAD_DIR)) {
        fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const app = (0, fastify_1.default)({
        logger: {
            level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
            transport: process.env.NODE_ENV !== 'production'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
        },
    });
    // ─── Plugins ──────────────────────────────────────────────────────────────
    await app.register(cors_1.default, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    await app.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
        sign: { expiresIn: (process.env.JWT_EXPIRES_IN || '30d') },
    });
    await app.register(multipart_1.default, {
        limits: {
            fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
        },
    });
    await app.register(static_1.default, {
        root: UPLOAD_DIR,
        prefix: '/uploads/',
    });
    // ─── Rotas ────────────────────────────────────────────────────────────────
    // Públicas
    await app.register(auth_1.default, { prefix: '/auth' });
    await app.register(catalogo_1.default, { prefix: '/catalogo' });
    // Autenticadas (exigem JWT)
    await app.register(upload_1.default, { prefix: '/upload' });
    await app.register(conta_1.default, { prefix: '/conta' });
    await app.register(touros_1.default, { prefix: '/touros' });
    await app.register(lotes_1.default, { prefix: '/lotes' });
    await app.register(inseminacoes_1.default, { prefix: '/inseminacoes' });
    await app.register(clientes_1.default, { prefix: '/clientes' });
    await app.register(sync_1.default, { prefix: '/sync' });
    // Health check
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
    // ─── Start ──────────────────────────────────────────────────────────────────
    try {
        await app.listen({ port: PORT, host: HOST });
        console.log(`\n🚀 AgroSemen API rodando em http://${HOST}:${PORT}\n`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map