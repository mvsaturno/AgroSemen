import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { db } from '../../src/database';
import { intencaoReserva, touro, loteSemen, inseminacao } from '../../src/database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { useAuthStore } from '../../src/store';
import { Ionicons } from '@expo/vector-icons';
import { SyncEngine } from '../../src/services/syncEngine';

type PedidoComTouro = {
  id: string;
  nomeComprador: string;
  telefoneComprador: string | null;
  tipoSemen: string;
  quantidade: number;
  status: string;
  updatedAt: string;
  touroNome: string;
  touroRaca: string;
  touroRegistro: string | null;
  touroId: string;
};

export default function PedidosScreen() {
  const authConta = useAuthStore(state => state.conta);
  const authUser = useAuthStore(state => state.user);
  const [pedidos, setPedidos] = useState<PedidoComTouro[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const carregarPedidos = async () => {
    try {
      const p = await db.select().from(intencaoReserva).orderBy(desc(intencaoReserva.updatedAt));
      const t = await db.select().from(touro);

      const mapeados = p.map(reserva => {
        const tr = t.find(x => x.id === reserva.touroId);
        return {
          id: reserva.id,
          nomeComprador: reserva.nomeComprador,
          telefoneComprador: reserva.telefoneComprador,
          tipoSemen: reserva.tipoSemen,
          quantidade: reserva.quantidade,
          status: reserva.status,
          updatedAt: reserva.updatedAt,
          touroNome: tr?.nome || 'Touro Excluído',
          touroRaca: tr?.raca || '',
          touroRegistro: tr?.codigoRegistro || null,
          touroId: reserva.touroId
        };
      });

      setPedidos(mapeados);
    } catch (error) {
      console.error('Erro ao carregar pedidos', error);
    }
  };

  useEffect(() => {
    carregarPedidos();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await SyncEngine.sync();
    await carregarPedidos();
    setRefreshing(false);
  };

  const aprovarPedido = async (item: PedidoComTouro) => {
    Alert.alert(
      'Aprovar Pedido',
      `Deseja realmente aprovar e dar baixa em ${item.quantidade} doses de ${item.touroNome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Aprovar', 
          onPress: async () => {
            try {
              // Achar o lote de semen correspondente
              const lotes = await db.select().from(loteSemen)
                .where(and(eq(loteSemen.touroId, item.touroId), eq(loteSemen.tipo, item.tipoSemen)));
              
              if (lotes.length === 0) {
                return Alert.alert('Erro', 'Lote de sêmen não encontrado no estoque local.');
              }

              // Pega o lote com mais saldo, ou o primeiro
              const lote = lotes.sort((a, b) => b.quantidade - a.quantidade)[0];

              const now = new Date().toISOString();

              // Registrar "inseminações/baixas" para a quantidade pedida
              for(let i = 0; i < item.quantidade; i++) {
                const insId = `ins_${Date.now()}_${i}_${Math.floor(Math.random()*1000)}`;
                await db.insert(inseminacao).values({
                  id: insId,
                  contaId: authConta!.id,
                  touroId: item.touroId,
                  loteSemenId: lote.id,
                  usuarioId: authUser!.id,
                  clienteId: null,
                  identificacaoVaca: `Venda - ${item.nomeComprador}`,
                  valorCobrado: null,
                  nota: `Baixa via Pedido do Catálogo`,
                  dataInseminacao: now,
                  isDirty: true,
                  createdAt: now,
                  updatedAt: now,
                });
              }

              // Mudar status do pedido
              await db.update(intencaoReserva)
                .set({ status: 'ATENDIDA', isDirty: true, updatedAt: now })
                .where(eq(intencaoReserva.id, item.id));

              Alert.alert('Sucesso', 'Pedido aprovado e estoque atualizado.');
              carregarPedidos();
              SyncEngine.sync(); // push para o servidor
            } catch (error) {
              console.error(error);
              Alert.alert('Erro', 'Ocorreu um erro ao aprovar.');
            }
          }
        }
      ]
    );
  };

  const rejeitarPedido = async (id: string) => {
    Alert.alert(
      'Rejeitar Pedido',
      'As doses bloqueadas serão devolvidas para o catálogo.',
      [
        { text: 'Voltar', style: 'cancel' },
        { 
          text: 'Rejeitar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const now = new Date().toISOString();
              await db.update(intencaoReserva)
                .set({ status: 'CANCELADA', isDirty: true, updatedAt: now })
                .where(eq(intencaoReserva.id, id));
              Alert.alert('Cancelado', 'O pedido foi rejeitado.');
              carregarPedidos();
              SyncEngine.sync();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível rejeitar o pedido.');
            }
          }
        }
      ]
    );
  };

  const formatTipoSemen = (tipo: string) => {
    if (tipo === 'CONVENCIONAL') return 'Convencional';
    if (tipo === 'SEXADO_MACHO') return 'Sexado Macho';
    if (tipo === 'SEXADO_FEMEA') return 'Sexado Fêmea';
    return tipo;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View className="flex-1 bg-surface-background p-4">
      <FlatList
        data={pedidos}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20 px-4">
            <Ionicons name="list" size={64} color="#9CA3AF" />
            <Text className="text-gray-500 text-lg mt-4 text-center">
              Nenhum pedido recebido. Compartilhe seu catálogo para receber reservas.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPendente = item.status === 'PENDENTE';
          const isAtendida = item.status === 'ATENDIDA';

          return (
            <View className={`bg-white p-5 rounded-2xl mb-4 shadow-sm border ${isPendente ? 'border-blue-200 bg-blue-50/20' : 'border-gray-100'}`}>
              <View className="flex-row justify-between items-start mb-2">
                <Text className="font-bold text-lg text-gray-900">{item.nomeComprador}</Text>
                <View className={`px-2 py-1 rounded text-xs font-bold ${
                  isPendente ? 'bg-blue-100 text-blue-800' : 
                  isAtendida ? 'bg-green-100 text-green-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  <Text className={`text-xs font-bold ${
                    isPendente ? 'text-blue-800' : 
                    isAtendida ? 'text-green-800' : 
                    'text-red-800'
                  }`}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <Text className="text-gray-500 text-sm mb-3">Feito em {formatDate(item.updatedAt)}</Text>

              <View className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
                <Text className="font-bold text-gray-800">{item.touroNome} <Text className="font-normal text-gray-500">({item.touroRaca})</Text></Text>
                <View className="flex-row items-center mt-2">
                  <Text className="text-sm font-bold text-primary mr-3">{item.quantidade} doses</Text>
                  <Text className="text-sm text-gray-600">{formatTipoSemen(item.tipoSemen)}</Text>
                </View>
              </View>

              {isPendente && (
                <View className="flex-row space-x-2">
                  <TouchableOpacity 
                    className="flex-1 border border-danger bg-white p-3 rounded-xl items-center"
                    onPress={() => rejeitarPedido(item.id)}
                  >
                    <Text className="text-danger font-bold text-sm">Rejeitar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    className="flex-1 bg-primary p-3 rounded-xl items-center"
                    onPress={() => aprovarPedido(item)}
                  >
                    <Text className="text-white font-bold text-sm">Aprovar e Baixar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
