import { api } from '../api/client';
import { db } from '../database';
import { eq } from 'drizzle-orm';
import {
  conta, usuario, touro, loteSemen, cliente, inseminacao, syncMetadata, intencaoReserva
} from '../database/schema';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store';

export class SyncEngine {
  private static listeners = new Set<() => void>();

  static subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.error('[SyncEngine] Error in sync listener:', e);
      }
    });
  }

  // Retorna a data do último sync
  static async getLastSyncedAt(): Promise<string | null> {
    try {
      const meta = await db.select().from(syncMetadata).limit(1);
      return meta[0]?.lastSyncedAt || null;
    } catch (e) {
      console.error('Failed to get last synced timestamp:', e);
      return null;
    }
  }

  // Atualiza a data do último sync
  static async setLastSyncedAt(dateStr: string) {
    try {
      const meta = await db.select().from(syncMetadata).limit(1);
      if (meta.length > 0) {
        await db.update(syncMetadata).set({ lastSyncedAt: dateStr }).where(eq(syncMetadata.id, meta[0].id));
      } else {
        await db.insert(syncMetadata).values({
          id: '1',
          usuarioId: 'local',
          deviceId: 'local',
          lastSyncedAt: dateStr,
        });
      }
    } catch (e) {
      console.error('Failed to set last synced timestamp:', e);
    }
  }

  // Sincronização completa
  static async sync() {
    const isLoggedIn = useAuthStore.getState().isLoggedIn;
    if (!isLoggedIn) {
      console.log('[SyncEngine] Sincronização abortada: usuário não está logado');
      return;
    }

    try {
      // 1. Obter ou gerar Device ID estável e persistente
      let deviceId = await SecureStore.getItemAsync('device_id');
      if (!deviceId) {
        deviceId = 'dev-device-' + Math.random().toString(36).substring(2, 15);
        await SecureStore.setItemAsync('device_id', deviceId);
      }

      // 2. Obter carimbo de data da última sincronização
      const lastSyncedAt = await this.getLastSyncedAt();

      // 3. Buscar alterações locais pendentes (isDirty = true)
      const inseminacoesDirty = await db
        .select()
        .from(inseminacao)
        .where(eq(inseminacao.isDirty, true));

      const tourosDirty = await db
        .select()
        .from(touro)
        .where(eq(touro.isDirty, true));

      const lotesDirty = await db
        .select()
        .from(loteSemen)
        .where(eq(loteSemen.isDirty, true));

      const clientesDirty = await db
        .select()
        .from(cliente)
        .where(eq(cliente.isDirty, true));

      const reservasDirty = await db
        .select()
        .from(intencaoReserva)
        .where(eq(intencaoReserva.isDirty, true));

      // 4. Preparar payload de push
      const push = {
        inseminacoes: inseminacoesDirty.map(i => ({
          id: i.id,
          touroId: i.touroId,
          loteSemenId: i.loteSemenId,
          clienteId: i.clienteId || null,
          identificacaoVaca: i.identificacaoVaca || null,
          valorCobrado: i.valorCobrado !== null ? Number(i.valorCobrado) : null,
          nota: i.nota || null,
          dataInseminacao: i.dataInseminacao,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          deletedAt: i.deletedAt || null,
        })),
        touros: tourosDirty.map(t => ({
          id: t.id,
          nome: t.nome,
          codigoRegistro: t.codigoRegistro || null,
          raca: t.raca,
          empresaFornecedora: t.empresaFornecedora || null,
          fotoUrl: t.fotoUrl || null,
          updatedAt: t.updatedAt,
          deletedAt: t.deletedAt || null,
        })),
        lotes: lotesDirty.map(l => ({
          id: l.id,
          touroId: l.touroId,
          tipo: l.tipo,
          quantidade: l.quantidade,
          valorUnitario: Number(l.valorUnitario),
          codigoPalheta: l.codigoPalheta || null,
          caneca: l.caneca || null,
          botijao: l.botijao || null,
          updatedAt: l.updatedAt,
          deletedAt: l.deletedAt || null,
        })),
        clientes: clientesDirty.map(c => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone || null,
          fazenda: c.fazenda || null,
          updatedAt: c.updatedAt,
          deletedAt: c.deletedAt || null,
        })),
        intencoesReserva: reservasDirty.map(r => ({
          id: r.id,
          status: r.status,
          updatedAt: r.updatedAt,
        }))
      };

      const payload = {
        deviceId,
        lastSyncedAt: lastSyncedAt || undefined,
        push
      };

      console.log('[SyncEngine] Iniciando sincronização. Payload:', JSON.stringify(payload));
      
      const response = await api.post('/sync', payload);

      if (response.status === 200 && response.data) {
        const data = response.data;
        const pull = data.pull || {};

        console.log('[SyncEngine] Resposta recebida. Pull items:', {
          touros: pull.touros?.length || 0,
          lotes: pull.lotes?.length || 0,
          clientes: pull.clientes?.length || 0,
          inseminacoes: pull.inseminacoes?.length || 0,
          intencoesReserva: pull.intencoesReserva?.length || 0
        });

        // A. Limpar marcação de dirty local para itens enviados com sucesso
        if (inseminacoesDirty.length > 0) {
          for (const i of inseminacoesDirty) {
            await db
              .update(inseminacao)
              .set({ isDirty: false })
              .where(eq(inseminacao.id, i.id));
          }
        }
        if (tourosDirty.length > 0) {
          for (const t of tourosDirty) {
            await db
              .update(touro)
              .set({ isDirty: false })
              .where(eq(touro.id, t.id));
          }
        }
        if (lotesDirty.length > 0) {
          for (const l of lotesDirty) {
            await db
              .update(loteSemen)
              .set({ isDirty: false })
              .where(eq(loteSemen.id, l.id));
          }
        }
        if (clientesDirty.length > 0) {
          for (const c of clientesDirty) {
            await db
              .update(cliente)
              .set({ isDirty: false })
              .where(eq(cliente.id, c.id));
          }
        }
        if (reservasDirty.length > 0) {
          for (const r of reservasDirty) {
            await db
              .update(intencaoReserva)
              .set({ isDirty: false })
              .where(eq(intencaoReserva.id, r.id));
          }
        }

        // B. Persistir itens baixados (pull) usando UPSERT no SQLite

        // Touros
        for (const t of pull.touros || []) {
          const item = {
            id: t.id,
            contaId: t.contaId,
            nome: t.nome,
            codigoRegistro: t.codigoRegistro || null,
            raca: t.raca,
            empresaFornecedora: t.empresaFornecedora || null,
            fotoUrl: t.fotoUrl || null,
            updatedAt: t.updatedAt,
            deletedAt: t.deletedAt || null,
            isDirty: false,
          };
          await db.insert(touro).values(item).onConflictDoUpdate({
            target: touro.id,
            set: item
          });
        }

        // Lotes
        for (const l of pull.lotes || []) {
          const item = {
            id: l.id,
            touroId: l.touroId,
            contaId: l.contaId,
            tipo: l.tipo,
            quantidade: Number(l.quantidade),
            valorUnitario: Number(l.valorUnitario),
            codigoPalheta: l.codigoPalheta || null,
            caneca: l.caneca || null,
            botijao: l.botijao || null,
            updatedAt: l.updatedAt,
            deletedAt: l.deletedAt || null,
            isDirty: false,
          };
          await db.insert(loteSemen).values(item).onConflictDoUpdate({
            target: loteSemen.id,
            set: item
          });
        }

        // Clientes
        for (const c of pull.clientes || []) {
          const item = {
            id: c.id,
            contaId: c.contaId,
            nome: c.nome,
            telefone: c.telefone || null,
            fazenda: c.fazenda || null,
            updatedAt: c.updatedAt,
            deletedAt: c.deletedAt || null,
            isDirty: false,
          };
          await db.insert(cliente).values(item).onConflictDoUpdate({
            target: cliente.id,
            set: item
          });
        }

        // Inseminações
        for (const i of pull.inseminacoes || []) {
          const item = {
            id: i.id,
            contaId: i.contaId,
            touroId: i.touroId,
            loteSemenId: i.loteSemenId,
            usuarioId: i.usuarioId,
            clienteId: i.clienteId || null,
            identificacaoVaca: i.identificacaoVaca || null,
            valorCobrado: i.valorCobrado !== null ? Number(i.valorCobrado) : null,
            nota: i.nota || null,
            dataInseminacao: i.dataInseminacao,
            isDirty: false, // veio do server, está limpo
            syncedAt: i.syncedAt || null,
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
            deletedAt: i.deletedAt || null,
          };
          await db.insert(inseminacao).values(item).onConflictDoUpdate({
            target: inseminacao.id,
            set: item
          });
        }

        // Reservas (Catálogo)
        for (const r of pull.intencoesReserva || []) {
          const item = {
            id: r.id,
            contaId: r.contaId,
            touroId: r.touroId,
            nomeComprador: r.nomeComprador,
            telefoneComprador: r.telefoneComprador || null,
            tipoSemen: r.tipoSemen,
            quantidade: Number(r.quantidade),
            status: r.status,
            updatedAt: r.updatedAt,
            isDirty: false,
          };
          await db.insert(intencaoReserva).values(item).onConflictDoUpdate({
            target: intencaoReserva.id,
            set: item
          });
        }

        // C. Atualizar data do último sync
        if (data.syncedAt) {
          await this.setLastSyncedAt(data.syncedAt);
        }

        console.log('[SyncEngine] Sincronização concluída com sucesso!');
        this.notify();
      } else {
        console.warn('[SyncEngine] Resposta de sincronização inválida:', response.status);
      }
    } catch (e) {
      console.error('[SyncEngine] Erro durante sincronização:', e);
    }
  }
}
