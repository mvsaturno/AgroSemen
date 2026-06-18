import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { db } from '../../src/database';
import { inseminacao, touro, cliente } from '../../src/database/schema';
import { useAuthStore } from '../../src/store';
import { isNull } from 'drizzle-orm';
import { Ionicons } from '@expo/vector-icons';
import EditInseminacaoModal from '../../components/EditInseminacaoModal';
import { exportToCSV } from '../../src/utils/exportCsv';
import { Alert } from 'react-native';

export default function HistoricoScreen() {
  const authConta = useAuthStore(state => state.conta);
  const isPrestador = authConta?.perfil === 'PRESTADOR';
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [tab, setTab] = useState<'GERAL' | 'CLIENTE' | 'TOURO'>('GERAL');
  const [periodo, setPeriodo] = useState<'SEMANA' | 'MES' | 'ANO' | 'TUDO'>('MES');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState('');

  const formatISOToLocale = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return isoStr;
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarHistorico();
    }, [])
  );

  const carregarHistorico = async () => {
    const t = await db.select().from(touro).where(isNull(touro.deletedAt));
    const c = await db.select().from(cliente).where(isNull(cliente.deletedAt));
    const ins = await db.select().from(inseminacao).where(isNull(inseminacao.deletedAt));

    const formatados = ins.map(i => {
      const tInfo = t.find(tx => tx.id === i.touroId);
      const cInfo = c.find(cx => cx.id === i.clienteId);

      return {
        ...i,
        touroNome: tInfo?.nome || 'Desconhecido',
        clienteNome: cInfo?.nome || 'Cliente sem identificação'
      };
    }).sort((a, b) => new Date(b.dataInseminacao).getTime() - new Date(a.dataInseminacao).getTime());

    setRegistros(formatados);
  };

  const registrosFiltrados = useMemo(() => {
    if (periodo === 'TUDO') return registros;
    const now = new Date();
    const limit = new Date();
    
    if (periodo === 'SEMANA') {
      limit.setDate(now.getDate() - 7);
    } else if (periodo === 'MES') {
      limit.setMonth(now.getMonth() - 1);
    } else if (periodo === 'ANO') {
      limit.setFullYear(now.getFullYear() - 1);
    }
    
    return registros.filter(r => new Date(r.dataInseminacao) >= limit);
  }, [registros, periodo]);

  // Estatisticas Gerais
  const totalAplicacoes = registrosFiltrados.length;
  const faturamentoTotal = registrosFiltrados.reduce((acc, curr) => acc + (Number(curr.valorCobrado) || 0), 0);

  // Agrupamentos
  const rankingClientes = useMemo(() => {
    const map = new Map<string, { nome: string, qtd: number, valor: number }>();
    registrosFiltrados.forEach(r => {
      const nome = r.clienteNome;
      if (!map.has(nome)) {
        map.set(nome, { nome, qtd: 0, valor: 0 });
      }
      const data = map.get(nome)!;
      data.qtd += 1;
      data.valor += (Number(r.valorCobrado) || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [registrosFiltrados]);

  const rankingTouros = useMemo(() => {
    const map = new Map<string, { nome: string, qtd: number }>();
    registrosFiltrados.forEach(r => {
      const nome = r.touroNome;
      if (!map.has(nome)) {
        map.set(nome, { nome, qtd: 0 });
      }
      const data = map.get(nome)!;
      data.qtd += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [registrosFiltrados]);

  const handleExportarHistorico = async () => {
    try {
      if (registrosFiltrados.length === 0) {
        Alert.alert('Aviso', 'Não há registros neste período para exportar.');
        return;
      }
      const dadosExportacao = registrosFiltrados.map(r => ({
        "Data": formatISOToLocale(r.dataInseminacao),
        "Touro": r.touroNome,
        "Cliente/Fazenda": r.clienteNome,
        "Vaca": r.identificacaoVaca || '-',
        "Valor (R$)": isPrestador ? Number(r.valorCobrado || 0).toFixed(2) : '-',
        "Status": r.isDirty ? 'Pendente' : 'Sincronizado'
      }));

      const fileName = `Historico_${periodo}_${new Date().getTime()}`;
      await exportToCSV(dadosExportacao, fileName);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha na exportação.');
    }
  };

  return (
    <View className="flex-1 bg-surface-background">
      <View className="bg-primary pt-12 pb-4 px-4 shadow-sm flex-row items-center justify-between">
        <Text className="text-white text-xl font-bold">Histórico</Text>
        <TouchableOpacity onPress={handleExportarHistorico} className="bg-white/20 p-2 rounded-full flex-row items-center px-3">
           <Ionicons name="download-outline" size={16} color="white" />
           <Text className="text-white font-bold text-xs ml-1">CSV</Text>
        </TouchableOpacity>
      </View>

      <View className="p-4 flex-1">
        {/* Abas */}
        <View className="flex-row bg-white rounded-full p-1 border border-gray-200 mb-4">
          <TouchableOpacity 
            className={`flex-1 py-2 items-center rounded-full ${tab === 'GERAL' ? 'bg-surface-background' : ''}`}
            onPress={() => setTab('GERAL')}
          >
            <Text className={`font-bold text-sm ${tab === 'GERAL' ? 'text-gray-900' : 'text-gray-500'}`}>Geral</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-2 items-center rounded-full ${tab === 'CLIENTE' ? 'bg-surface-background' : ''}`}
            onPress={() => setTab('CLIENTE')}
          >
            <Text className={`font-bold text-sm ${tab === 'CLIENTE' ? 'text-gray-900' : 'text-gray-500'}`}>Por Cliente</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-2 items-center rounded-full ${tab === 'TOURO' ? 'bg-surface-background' : ''}`}
            onPress={() => setTab('TOURO')}
          >
            <Text className={`font-bold text-sm ${tab === 'TOURO' ? 'text-gray-900' : 'text-gray-500'}`}>Por Touro</Text>
          </TouchableOpacity>
        </View>

        {/* Filtro de Período */}
        <View className="flex-row justify-between mb-4">
          {['SEMANA', 'MES', 'ANO', 'TUDO'].map(p => (
            <TouchableOpacity 
              key={p}
              onPress={() => setPeriodo(p as any)}
              className={`flex-1 mx-1 py-1.5 items-center rounded-full border ${periodo === p ? 'bg-primary/10 border-primary/30' : 'bg-white border-gray-200 shadow-sm'}`}
            >
              <Text className={`text-xs font-bold ${periodo === p ? 'text-primary' : 'text-gray-500'}`}>
                {p === 'SEMANA' ? '7 Dias' : p === 'MES' ? '30 Dias' : p === 'ANO' ? '1 Ano' : 'Tudo'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Conteúdo Aba */}
        {tab === 'GERAL' && (
          <FlatList
            data={registrosFiltrados}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={
              <View className="flex-row mb-4">
                <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 mr-2 items-center shadow-sm">
                  <Text className="text-gray-500 text-sm font-semibold mb-1">Aplicações</Text>
                  <Text className="text-2xl font-bold text-gray-900">{totalAplicacoes}</Text>
                </View>
                {isPrestador && (
                  <View className="flex-1 bg-primary/5 p-4 rounded-2xl border border-primary/20 ml-2 items-center shadow-sm">
                    <Text className="text-primary-dark text-sm font-semibold mb-1">Faturamento</Text>
                    <Text className="text-xl font-bold text-primary-dark">R$ {faturamentoTotal.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity 
                className="bg-white p-5 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row items-center justify-between"
                onPress={() => {
                  setEditingId(item.id);
                  setEditModalVisible(true);
                }}
              >
                <View className="flex-1 mr-4">
                  <View className="flex-row justify-between mb-2">
                    <Text className="font-bold text-lg text-gray-900">{item.touroNome}</Text>
                    {isPrestador && (
                      <Text className="text-primary font-bold text-lg">R$ {Number(item.valorCobrado || 0).toFixed(2)}</Text>
                    )}
                  </View>
                  <Text className="text-gray-700 text-sm mb-1">Cliente: {item.clienteNome}</Text>
                  {item.identificacaoVaca ? (
                    <Text className="text-gray-700 text-sm mb-1">Vaca: {item.identificacaoVaca}</Text>
                  ) : null}
                  <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
                    <Text className="text-gray-500 text-xs flex-row items-center">
                      <Ionicons name="calendar-outline" size={12} /> {formatISOToLocale(item.dataInseminacao)}
                    </Text>
                    {item.isDirty && (
                      <Text className="text-warning font-bold text-xs flex-row items-center">
                        <Ionicons name="sync-outline" size={12} /> Pendente
                      </Text>
                    )}
                  </View>
                </View>
                <View className="w-10 h-10 rounded-full bg-surface-background border border-gray-200 items-center justify-center">
                  <Ionicons name="pencil-outline" size={18} color="#4B5563" />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text className="text-center text-gray-500 mt-4">Nenhum registro no período.</Text>}
          />
        )}

        {tab === 'CLIENTE' && (
          <FlatList
            data={rankingClientes}
            keyExtractor={item => item.nome}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item, index }) => (
              <View className="bg-white p-5 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4">
                  <Text className="font-bold text-gray-600">#{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-lg text-gray-900">{item.nome}</Text>
                  <Text className="text-gray-500 text-sm">{item.qtd} {item.qtd === 1 ? 'aplicação' : 'aplicações'}</Text>
                </View>
                {isPrestador && (
                  <View>
                    <Text className="font-bold text-primary text-base">R$ {item.valor.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={<Text className="text-center text-gray-500 mt-4">Nenhum registro no período.</Text>}
          />
        )}

        {tab === 'TOURO' && (
          <FlatList
            data={rankingTouros}
            keyExtractor={item => item.nome}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item, index }) => (
              <View className="bg-white p-5 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
                  <Text className="font-bold text-primary">#{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-lg text-gray-900">{item.nome}</Text>
                  <Text className="text-gray-500 text-sm">{item.qtd} {item.qtd === 1 ? 'dose utilizada' : 'doses utilizadas'}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text className="text-center text-gray-500 mt-4">Nenhum registro no período.</Text>}
          />
        )}
      </View>

      <EditInseminacaoModal 
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        inseminacaoId={editingId}
        onSaveSuccess={() => carregarHistorico()}
      />
    </View>
  );
}
