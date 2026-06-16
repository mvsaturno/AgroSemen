"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = uploadRoutes;
const authenticate_1 = require("../middleware/authenticate");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const UPLOAD_DIR = path_1.default.resolve(process.env.UPLOAD_DIR || path_1.default.join(process.cwd(), 'uploads'));
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://163.176.47.4';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
async function uploadRoutes(app) {
    // ─── POST /upload ─────────────────────────────────────────────────────────
    // Upload de foto de touro (multipart/form-data)
    app.post('/', { preHandler: authenticate_1.authenticate }, async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.status(400).send({ error: 'Nenhum arquivo enviado.' });
        }
        if (!ALLOWED_TYPES.includes(data.mimetype)) {
            return reply.status(400).send({ error: 'Formato inválido. Use JPG, PNG ou WebP.' });
        }
        const ext = data.filename.split('.').pop() || 'jpg';
        const filename = `${(0, uuid_1.v4)()}.${ext}`;
        const filepath = path_1.default.join(UPLOAD_DIR, filename);
        // Garante que o diretório existe
        fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
        const writeStream = fs_1.default.createWriteStream(filepath);
        await new Promise((resolve, reject) => {
            data.file.pipe(writeStream);
            data.file.on('end', resolve);
            data.file.on('error', reject);
        });
        const url = `${PUBLIC_URL}/uploads/${filename}`;
        return reply.status(201).send({ url, filename });
    });
}
//# sourceMappingURL=upload.js.map