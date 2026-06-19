import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';

export const sqliteDb = SQLite.openDatabaseSync('agrosemen.db');
export const db = drizzle(sqliteDb, { schema });

export const initializeDb = () => {
  // Verifica se a tabela conta existe e se tem a coluna slug
  let dbNeedsReset = false;
  try {
    const tableInfo = sqliteDb.getAllSync('PRAGMA table_info(conta)') as any[];
    if (tableInfo.length > 0) {
      const hasSlug = tableInfo.some(col => col.name === 'slug');
      if (!hasSlug) {
        dbNeedsReset = true;
      }
    }

    // Verifica se a tabela touro tem a coluna isDirty
    const touroTableInfo = sqliteDb.getAllSync('PRAGMA table_info(touro)') as any[];
    if (touroTableInfo.length > 0) {
      const hasIsDirty = touroTableInfo.some(col => col.name === 'isDirty');
      if (!hasIsDirty) {
        dbNeedsReset = true;
      }
    }
  } catch (e) {
    // Se a tabela não existe, não faz nada
  }

  if (dbNeedsReset) {
    console.log('Detectada estrutura antiga do banco de dados SQLite. Recriando tabelas...');
    sqliteDb.execSync(`
      DROP TABLE IF EXISTS sync_metadata;
      DROP TABLE IF EXISTS inseminacao;
      DROP TABLE IF EXISTS cliente;
      DROP TABLE IF EXISTS lote_semen;
      DROP TABLE IF EXISTS touro;
      DROP TABLE IF EXISTS usuario;
      DROP TABLE IF EXISTS conta;
    `);
  }

  sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS conta (
      id TEXT PRIMARY KEY NOT NULL,
      nome TEXT NOT NULL,
      slug TEXT NOT NULL,
      whatsappCatalogo TEXT,
      perfil TEXT NOT NULL,
      estoqueMinAlerta INTEGER NOT NULL DEFAULT 5,
      valorPadraoCon REAL NOT NULL DEFAULT 0,
      valorPadraoSex REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usuario (
      id TEXT PRIMARY KEY NOT NULL,
      contaId TEXT NOT NULL,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      pinHash TEXT NOT NULL,
      papel TEXT NOT NULL,
      FOREIGN KEY (contaId) REFERENCES conta (id)
    );

    CREATE TABLE IF NOT EXISTS touro (
      id TEXT PRIMARY KEY NOT NULL,
      contaId TEXT NOT NULL,
      nome TEXT NOT NULL,
      codigoRegistro TEXT,
      raca TEXT NOT NULL,
      empresaFornecedora TEXT,
      fotoUrl TEXT,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      isDirty INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (contaId) REFERENCES conta (id)
    );

    CREATE TABLE IF NOT EXISTS lote_semen (
      id TEXT PRIMARY KEY NOT NULL,
      touroId TEXT NOT NULL,
      contaId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 0,
      valorUnitario REAL NOT NULL DEFAULT 0,
      codigoPalheta TEXT,
      caneca TEXT,
      botijao TEXT,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      isDirty INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (touroId) REFERENCES touro (id),
      FOREIGN KEY (contaId) REFERENCES conta (id)
    );

    CREATE TABLE IF NOT EXISTS cliente (
      id TEXT PRIMARY KEY NOT NULL,
      contaId TEXT NOT NULL,
      nome TEXT NOT NULL,
      telefone TEXT,
      fazenda TEXT,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      isDirty INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (contaId) REFERENCES conta (id)
    );

    CREATE TABLE IF NOT EXISTS inseminacao (
      id TEXT PRIMARY KEY NOT NULL,
      contaId TEXT NOT NULL,
      touroId TEXT NOT NULL,
      loteSemenId TEXT NOT NULL,
      usuarioId TEXT NOT NULL,
      clienteId TEXT,
      identificacaoVaca TEXT,
      valorCobrado REAL,
      nota TEXT,
      dataInseminacao TEXT NOT NULL,
      isDirty INTEGER NOT NULL DEFAULT 0,
      syncedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      FOREIGN KEY (contaId) REFERENCES conta (id),
      FOREIGN KEY (touroId) REFERENCES touro (id),
      FOREIGN KEY (loteSemenId) REFERENCES lote_semen (id),
      FOREIGN KEY (usuarioId) REFERENCES usuario (id),
      FOREIGN KEY (clienteId) REFERENCES cliente (id)
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      id TEXT PRIMARY KEY NOT NULL,
      usuarioId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      lastSyncedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intencao_reserva (
      id TEXT PRIMARY KEY NOT NULL,
      contaId TEXT NOT NULL,
      touroId TEXT NOT NULL,
      nomeComprador TEXT NOT NULL,
      telefoneComprador TEXT,
      tipoSemen TEXT NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      updatedAt TEXT NOT NULL,
      isDirty INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (contaId) REFERENCES conta (id),
      FOREIGN KEY (touroId) REFERENCES touro (id)
    );
  `);
};
