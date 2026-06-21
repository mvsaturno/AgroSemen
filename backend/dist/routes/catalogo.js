"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = catalogoRoutes;
const database_1 = __importDefault(require("../database"));
const zod_1 = require("zod");
const authenticate_1 = require("../middleware/authenticate");
const crypto_1 = require("crypto");
async function catalogoRoutes(app) {
    // ─── POST /catalogo/gerar-link ───────────────────────────────────────────
    app.post('/gerar-link', { preHandler: [authenticate_1.authenticate] }, async (request, reply) => {
        const user = request.user;
        const token = (0, crypto_1.randomBytes)(16).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await database_1.default.linkCatalogo.create({
            data: {
                contaId: user.contaId,
                token,
                expiresAt,
            }
        });
        const baseUrl = process.env.PUBLIC_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '3000'}`;
        const link = `${baseUrl}/catalogo/c/${token}`;
        return reply.send({ link, token, expiresAt });
    });
    // ─── GET /catalogo/api/:token ───────────────────────────────────────────
    app.get('/api/:token', async (request, reply) => {
        const { token } = request.params;
        const link = await database_1.default.linkCatalogo.findUnique({
            where: { token },
            include: { conta: true }
        });
        if (!link || link.expiresAt < new Date()) {
            return reply.status(401).send({ error: 'Link expirado ou inválido.' });
        }
        const touros = await database_1.default.touro.findMany({
            where: { contaId: link.contaId, deletedAt: null },
            include: {
                lotes: { where: { deletedAt: null } },
                intencoesReserva: { where: { status: 'PENDENTE' } }
            }
        });
        const catalogo = touros.map(t => {
            const saldos = {
                CONVENCIONAL: t.lotes.filter(l => l.tipo === 'CONVENCIONAL').reduce((acc, l) => acc + l.quantidade, 0),
                SEXADO_MACHO: t.lotes.filter(l => l.tipo === 'SEXADO_MACHO').reduce((acc, l) => acc + l.quantidade, 0),
                SEXADO_FEMEA: t.lotes.filter(l => l.tipo === 'SEXADO_FEMEA').reduce((acc, l) => acc + l.quantidade, 0),
            };
            t.intencoesReserva.forEach(r => {
                saldos[r.tipoSemen] -= r.quantidade;
            });
            return {
                id: t.id,
                nome: t.nome,
                raca: t.raca,
                codigoRegistro: t.codigoRegistro,
                fotoUrl: t.fotoUrl,
                qtdConvencional: Math.max(0, saldos.CONVENCIONAL),
                qtdMacho: Math.max(0, saldos.SEXADO_MACHO),
                qtdFemea: Math.max(0, saldos.SEXADO_FEMEA),
            };
        }).filter(t => t.qtdConvencional > 0 || t.qtdMacho > 0 || t.qtdFemea > 0);
        return reply.send({
            conta: { nome: link.conta.nome, whatsapp: link.conta.whatsappCatalogo },
            touros: catalogo
        });
    });
    // ─── POST /catalogo/api/:token/reservas ─────────────────────────────────
    app.post('/api/:token/reservas', async (request, reply) => {
        const { token } = request.params;
        const schema = zod_1.z.object({
            touroId: zod_1.z.string().uuid(),
            tipoSemen: zod_1.z.enum(['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA']),
            quantidade: zod_1.z.number().int().min(1),
            nomeComprador: zod_1.z.string().min(1),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        const link = await database_1.default.linkCatalogo.findUnique({
            where: { token },
            include: { conta: true }
        });
        if (!link || link.expiresAt < new Date())
            return reply.status(401).send({ error: 'Link expirado ou inválido.' });
        const touro = await database_1.default.touro.findFirst({
            where: { id: parsed.data.touroId, contaId: link.contaId, deletedAt: null },
            include: {
                lotes: { where: { deletedAt: null } },
                intencoesReserva: { where: { status: 'PENDENTE' } }
            }
        });
        if (!touro)
            return reply.status(404).send({ error: 'Touro não encontrado.' });
        let saldoAtual = touro.lotes.filter(l => l.tipo === parsed.data.tipoSemen).reduce((acc, l) => acc + l.quantidade, 0);
        touro.intencoesReserva.filter(r => r.tipoSemen === parsed.data.tipoSemen).forEach(r => saldoAtual -= r.quantidade);
        if (parsed.data.quantidade > saldoAtual) {
            return reply.status(400).send({ error: 'Quantidade solicitada excede o saldo disponível neste momento.' });
        }
        const reserva = await database_1.default.intencaoReserva.create({
            data: {
                contaId: link.contaId,
                touroId: touro.id,
                nomeComprador: parsed.data.nomeComprador,
                tipoSemen: parsed.data.tipoSemen,
                quantidade: parsed.data.quantidade,
                status: 'PENDENTE',
            }
        });
        const tipoLabel = {
            CONVENCIONAL: 'Convencional',
            SEXADO_MACHO: 'Sexado ♂ (Macho)',
            SEXADO_FEMEA: 'Sexado ♀ (Fêmea)',
        };
        const mensagem = encodeURIComponent(`Olá! Fiz uma reserva no seu catálogo:\n` +
            `Touro: *${touro.nome}*\n` +
            `Tipo: ${tipoLabel[parsed.data.tipoSemen]}\n` +
            `Quantidade: ${parsed.data.quantidade} doses\n` +
            `Meu nome: ${parsed.data.nomeComprador}`);
        const whatsappUrl = link.conta.whatsappCatalogo
            ? `https://wa.me/${link.conta.whatsappCatalogo.replace(/\D/g, '')}?text=${mensagem}`
            : null;
        return reply.status(201).send({ reserva: { id: reserva.id }, whatsappUrl });
    });
    // ─── GET /catalogo/c/:token ───────────────────────────────────────────
    app.get('/c/:token', async (request, reply) => {
        reply.header('Content-Type', 'text/html; charset=utf-8');
        const { token } = request.params;
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catálogo de Touros</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen text-gray-900 pb-10">

  <div id="app">
    <div class="p-8 text-center text-gray-500">Carregando catálogo...</div>
  </div>

  <div id="modal" class="fixed inset-0 bg-black/60 z-50 hidden flex items-end sm:items-center justify-center">
    <div class="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl p-6 transform transition-all shadow-xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold text-gray-900">Reservar Doses</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <p id="modal-touro" class="font-bold text-green-700 mb-4"></p>
      
      <div class="mb-4">
        <label class="block text-sm font-bold text-gray-700 mb-1">Seu Nome *</label>
        <input type="text" id="comprador" class="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="Digite seu nome">
      </div>

      <div class="mb-4">
        <label class="block text-sm font-bold text-gray-700 mb-1">Tipo de Sêmen *</label>
        <select id="tipo" class="w-full border border-gray-300 p-3 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:outline-none" onchange="updateMax()"></select>
      </div>

      <div class="mb-6">
        <label class="block text-sm font-bold text-gray-700 mb-1">Quantidade *</label>
        <input type="number" id="qtd" min="1" value="1" class="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none">
        <p id="saldo-hint" class="text-xs text-gray-500 mt-1"></p>
      </div>

      <button id="btn-reservar" onclick="reservar()" class="w-full bg-green-700 text-white font-bold py-3 rounded-xl hover:bg-green-800 transition">Confirmar Reserva</button>
    </div>
  </div>

  <script>
    const token = "${token}";
    let tourosData = [];
    let selectedTouro = null;

    async function load() {
      try {
        const res = await fetch('/catalogo/api/' + token);
        if (!res.ok) {
          const e = await res.json();
          document.getElementById('app').innerHTML = '<div class="p-8 text-center text-red-600 font-bold mt-10 bg-red-50 rounded-xl mx-4 shadow-sm border border-red-100">' + (e.error || 'Erro ao carregar') + '</div>';
          return;
        }
        const data = await res.json();
        tourosData = data.touros;
        render(data.conta, data.touros);
      } catch (err) {
        document.getElementById('app').innerHTML = '<div class="p-8 text-center text-red-600 font-bold mt-10">Erro de conexão.</div>';
      }
    }

    function render(conta, touros) {
      let html = '<header class="bg-white border-b border-gray-200 px-4 py-6 shadow-sm"><div class="max-w-3xl mx-auto"><h1 class="text-2xl font-black text-gray-900">' + conta.nome + '</h1><p class="text-sm text-gray-500 mt-1">Catálogo de Reprodutores</p></div></header>';
      
      html += '<main class="max-w-3xl mx-auto p-4">';
      
      if(touros.length === 0) {
        html += '<div class="bg-white p-6 rounded-xl text-center text-gray-500 border border-gray-200 shadow-sm">Nenhum touro com saldo disponível.</div>';
      } else {
        html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
        touros.forEach(t => {
          let tags = '';
          if(t.qtdConvencional > 0) tags += '<span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold mr-1">Conv.</span>';
          if(t.qtdMacho > 0) tags += '<span class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold mr-1">Macho</span>';
          if(t.qtdFemea > 0) tags += '<span class="bg-pink-50 text-pink-700 px-2 py-1 rounded text-xs font-bold mr-1">Fêmea</span>';

          const img = t.fotoUrl && t.fotoUrl.startsWith('http') ? t.fotoUrl : (t.fotoUrl ? '/uploads/' + t.fotoUrl : '');
          const imgHtml = img ? '<img src="'+img+'" class="w-full h-48 object-cover">' : '<div class="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">Sem Foto</div>';

          html += '<div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">' + imgHtml + '<div class="p-4"><div class="flex justify-between items-start"><h2 class="font-bold text-lg text-gray-900">' + t.nome + '</h2><span class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">' + (t.raca || 'S/ Raça') + '</span></div><div class="mt-3 flex flex-wrap">' + tags + '</div><button onclick="openModal(\\''+t.id+'\\')" class="mt-4 w-full bg-green-50 text-green-700 font-bold py-2 rounded-lg hover:bg-green-100 border border-green-200">Reservar</button></div></div>';
        });
        html += '</div>';
      }
      html += '</main>';
      document.getElementById('app').innerHTML = html;
    }

    function openModal(id) {
      selectedTouro = tourosData.find(x => x.id === id);
      document.getElementById('modal-touro').innerText = selectedTouro.nome;
      
      let options = '';
      if(selectedTouro.qtdConvencional > 0) options += '<option value="CONVENCIONAL">Convencional ('+selectedTouro.qtdConvencional+' disponíveis)</option>';
      if(selectedTouro.qtdMacho > 0) options += '<option value="SEXADO_MACHO">Sexado Macho ('+selectedTouro.qtdMacho+' disponíveis)</option>';
      if(selectedTouro.qtdFemea > 0) options += '<option value="SEXADO_FEMEA">Sexado Fêmea ('+selectedTouro.qtdFemea+' disponíveis)</option>';
      
      document.getElementById('tipo').innerHTML = options;
      document.getElementById('comprador').value = '';
      document.getElementById('qtd').value = 1;
      updateMax();
      
      document.getElementById('modal').classList.remove('hidden');
    }

    function closeModal() {
      document.getElementById('modal').classList.add('hidden');
      selectedTouro = null;
    }

    function updateMax() {
      const tipo = document.getElementById('tipo').value;
      let max = 0;
      if(tipo === 'CONVENCIONAL') max = selectedTouro.qtdConvencional;
      if(tipo === 'SEXADO_MACHO') max = selectedTouro.qtdMacho;
      if(tipo === 'SEXADO_FEMEA') max = selectedTouro.qtdFemea;
      document.getElementById('qtd').max = max;
      document.getElementById('saldo-hint').innerText = "Máximo disponível: " + max;
    }

    async function reservar() {
      const nome = document.getElementById('comprador').value.trim();
      const tipo = document.getElementById('tipo').value;
      const qtd = parseInt(document.getElementById('qtd').value, 10);
      
      if(!nome) return alert('Por favor, digite seu nome.');
      if(!qtd || qtd < 1) return alert('Quantidade inválida.');

      const btn = document.getElementById('btn-reservar');
      btn.disabled = true;
      btn.innerText = 'Processando...';

      try {
        const res = await fetch('/catalogo/api/' + token + '/reservas', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            touroId: selectedTouro.id,
            tipoSemen: tipo,
            quantidade: qtd,
            nomeComprador: nome
          })
        });

        const data = await res.json();
        if(!res.ok) {
          alert(data.error || 'Erro na reserva');
          btn.disabled = false;
          btn.innerText = 'Confirmar Reserva';
          return;
        }

        if(data.whatsappUrl) {
          window.location.href = data.whatsappUrl;
        } else {
          alert('Reserva efetuada! O fornecedor não possui WhatsApp cadastrado.');
          closeModal();
          load(); // recarrega saldos
        }

      } catch(err) {
        alert('Erro ao conectar.');
        btn.disabled = false;
        btn.innerText = 'Confirmar Reserva';
      }
    }

    load();
  </script>
</body>
</html>`;
    });
}
//# sourceMappingURL=catalogo.js.map