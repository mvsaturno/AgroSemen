import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const conta = sqliteTable('conta', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  slug: text('slug').notNull(),
  whatsappCatalogo: text('whatsappCatalogo'),
  perfil: text('perfil').notNull(), // 'USO_PROPRIO' | 'PRESTADOR'
  estoqueMinAlerta: integer('estoqueMinAlerta').notNull().default(5),
  valorPadraoCon: real('valorPadraoCon').notNull().default(0),
  valorPadraoSex: real('valorPadraoSex').notNull().default(0),
});

export const usuario = sqliteTable('usuario', {
  id: text('id').primaryKey(),
  contaId: text('contaId').notNull().references(() => conta.id),
  nome: text('nome').notNull(),
  telefone: text('telefone').notNull(),
  pinHash: text('pinHash').notNull(),
  papel: text('papel').notNull(), // 'ADMIN' | 'USUARIO'
});

export const touro = sqliteTable('touro', {
  id: text('id').primaryKey(),
  contaId: text('contaId').notNull().references(() => conta.id),
  nome: text('nome').notNull(),
  codigoRegistro: text('codigoRegistro'),
  raca: text('raca').notNull(),
  empresaFornecedora: text('empresaFornecedora'),
  fotoUrl: text('fotoUrl'),
  updatedAt: text('updatedAt').notNull(),
  deletedAt: text('deletedAt'),
  isDirty: integer('isDirty', { mode: 'boolean' }).notNull().default(false),
});

export const loteSemen = sqliteTable('lote_semen', {
  id: text('id').primaryKey(),
  touroId: text('touroId').notNull().references(() => touro.id),
  contaId: text('contaId').notNull().references(() => conta.id),
  tipo: text('tipo').notNull(), // 'CONVENCIONAL' | 'SEXADO_MACHO' | 'SEXADO_FEMEA'
  quantidade: integer('quantidade').notNull().default(0),
  valorUnitario: real('valorUnitario').notNull().default(0),
  codigoPalheta: text('codigoPalheta'),
  caneca: text('caneca'),
  botijao: text('botijao'),
  updatedAt: text('updatedAt').notNull(),
  deletedAt: text('deletedAt'),
  isDirty: integer('isDirty', { mode: 'boolean' }).notNull().default(false),
});

export const cliente = sqliteTable('cliente', {
  id: text('id').primaryKey(),
  contaId: text('contaId').notNull().references(() => conta.id),
  nome: text('nome').notNull(),
  telefone: text('telefone'),
  fazenda: text('fazenda'),
  updatedAt: text('updatedAt').notNull(),
  deletedAt: text('deletedAt'),
  isDirty: integer('isDirty', { mode: 'boolean' }).notNull().default(false),
});

export const inseminacao = sqliteTable('inseminacao', {
  id: text('id').primaryKey(),
  contaId: text('contaId').notNull().references(() => conta.id),
  touroId: text('touroId').notNull().references(() => touro.id),
  loteSemenId: text('loteSemenId').notNull().references(() => loteSemen.id),
  usuarioId: text('usuarioId').notNull().references(() => usuario.id),
  clienteId: text('clienteId').references(() => cliente.id),
  identificacaoVaca: text('identificacaoVaca'),
  valorCobrado: real('valorCobrado'),
  nota: text('nota'),
  dataInseminacao: text('dataInseminacao').notNull(), // ISO string
  isDirty: integer('isDirty', { mode: 'boolean' }).notNull().default(false), // true = criado/editado offline
  syncedAt: text('syncedAt'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
  deletedAt: text('deletedAt'),
});

export const syncMetadata = sqliteTable('sync_metadata', {
  id: text('id').primaryKey(),
  usuarioId: text('usuarioId').notNull(),
  deviceId: text('deviceId').notNull(),
  lastSyncedAt: text('lastSyncedAt').notNull(),
});

export const intencaoReserva = sqliteTable('intencao_reserva', {
  id: text('id').primaryKey(),
  contaId: text('contaId').notNull().references(() => conta.id),
  touroId: text('touroId').notNull().references(() => touro.id),
  nomeComprador: text('nomeComprador').notNull(),
  telefoneComprador: text('telefoneComprador'),
  tipoSemen: text('tipoSemen').notNull(),
  quantidade: integer('quantidade').notNull().default(1),
  status: text('status').notNull().default('PENDENTE'),
  updatedAt: text('updatedAt').notNull(),
  isDirty: integer('isDirty', { mode: 'boolean' }).notNull().default(false),
});
