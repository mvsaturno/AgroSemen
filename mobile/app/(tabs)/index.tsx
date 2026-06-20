import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator, Share, Alert } from 'react-native';
import { db } from '../../src/database';
import { touro, loteSemen, inseminacao } from '../../src/database/schema';
import { eq, sum, isNull, and } from 'drizzle-orm';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAuthStore } from '../../src/store';
import { Ionicons } from '@expo/vector-icons';
import { SyncEngine } from '../../src/services/syncEngine';
import { api } from '../../src/api/client';

type TouroComTotais = {
  id: string;
  nome: string;
  raca: string;
  codigoRegistro: string | null;
  totalConvencional: number;
  totalSexado: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const authConta = useAuthStore(state => state.conta);
  const authUser = useAuthStore(state => state.user);
  const [saldoReal, setSaldoReal] = useState(0);
  const [touros, setTouros] = useState<TouroComTotais[]>([]);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [comprasAlertaCount, setComprasAlertaCount] = useState(0);
  const [gerandoLink, setGerandoLink] = useState(false);

  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe(() => {
      console.log('[HomeScreen] Sync completed, reloading...');
      carregarEstoque();
    });
    return unsubscribe;
  }, []);

  const handleGerarLinkCatalogo = async () => {
    setGerandoLink(true);
    try {
      const res = await api.post('/catalogo/gerar-link');
      const { link } = res.data;
      await Share.share({
        message: `Veja o meu catálogo de touros disponíveis para reserva no AgroSêmen! (Link válido por 24h)\n\n${link}`,
        title: 'Catálogo AgroSêmen',
      });
    } catch (e: any) {
      const errMsg = e.response?.data?.message || e.response?.data?.error || e.message || 'Falha ao gerar link do catálogo.';
      const statusSuffix = e.response?.status ? ` (Código HTTP: ${e.response.status})` : '';
      Alert.alert('Erro', `${errMsg}${statusSuffix}\n\nVerifique sua conexão e tente novamente após sincronizar.`);
    } finally {
      setGerandoLink(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarEstoque();
    }, [authConta?.estoqueMinAlerta])
  );

  const carregarEstoque = async () => {
    const lotes = await db.select({ total: sum(loteSemen.quantidade) }).from(loteSemen).where(isNull(loteSemen.deletedAt));
    const saldoServidor = lotes[0]?.total || 0;

    const inseminacoesPendentes = await db.select()
      .from(inseminacao)
      .where(and(eq(inseminacao.isDirty, true), isNull(inseminacao.deletedAt)));

    setSaldoReal(Number(saldoServidor) - inseminacoesPendentes.length);

    const todosTouros = await db.select().from(touro).where(isNull(touro.deletedAt));
    const todosLotes = await db.select().from(loteSemen).where(isNull(loteSemen.deletedAt));

    const agrupado = todosTouros.map(t => {
      const lotesDoTouro = todosLotes.filter(l => l.touroId === t.id);
      const totalConvencional = lotesDoTouro.filter(l => l.tipo === 'CONVENCIONAL').reduce((acc, l) => acc + l.quantidade, 0);
      const totalSexado = lotesDoTouro.filter(l => l.tipo !== 'CONVENCIONAL').reduce((acc, l) => acc + l.quantidade, 0);
      return {
        ...t,
        totalConvencional,
        totalSexado,
      };
    });

    setTouros(agrupado);

    // Conta touros em alerta para o badge de Compras
    const minAlerta = authConta?.estoqueMinAlerta ?? 5;
    const emAlerta = agrupado.filter(t => (t.totalConvencional + t.totalSexado) <= minAlerta);
    setComprasAlertaCount(emAlerta.length);
  };

  const tourosEmAlerta = touros.filter(t => (t.totalConvencional + t.totalSexado) <= (authConta?.estoqueMinAlerta || 5));

  return (
    <View className="flex-1 bg-surface-background">
      <View className="bg-primary pt-12 pb-6 px-4 flex-row items-center justify-between shadow-sm">
        <Text className="text-white text-2xl font-bold">Início</Text>
        <Text className="text-white/90 text-sm">Olá, {authUser?.nome || (authConta?.perfil === 'PRESTADOR' ? 'Ginete' : 'Fazendeiro')}</Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}>
        {/* Card Resumo Estoque (Design Referência) */}
      <TouchableOpacity 
        className="bg-primary-dark rounded-3xl p-6 shadow-sm mb-6 flex-row justify-between items-center"
        onPress={() => setModalVisivel(true)}
      >
        <View className="flex-row items-center flex-1">
          <View className="bg-white/20 p-4 rounded-full mr-4">
            <Ionicons name="cube-outline" size={28} color="white" />
          </View>
          <View>
            <Text className="text-white/90 text-sm mb-1">Estoque atual</Text>
            <Text className="text-4xl font-bold text-white mb-1">{saldoReal}</Text>
            <Text className="text-white/80 text-xs">palhetas em {touros.length} touros · toque para detalhes</Text>
          </View>
        </View>
        <Ionicons name="eye-outline" size={24} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Card Compartilhar Catálogo */}
      <TouchableOpacity 
        className="bg-blue-600 rounded-3xl p-6 shadow-sm mb-6 flex-row justify-between items-center"
        onPress={handleGerarLinkCatalogo}
        disabled={gerandoLink}
      >
        <View className="flex-row items-center flex-1 mr-2">
          <View className="bg-white/20 p-4 rounded-full mr-4">
            {gerandoLink ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="share-social" size={28} color="white" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white/90 text-sm mb-1">Catálogo de Vendas</Text>
            <Text className="text-2xl font-bold text-white mb-1">Compartilhar Catálogo</Text>
            <Text className="text-white/80 text-xs">Gere e envie o link de 24h para seus compradores</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <View className="pb-8">
        {/* Linha 1 */}
        <View className="flex-row justify-between mb-6">
          <TouchableOpacity 
            className="flex-1 bg-primary-dark rounded-3xl py-10 px-4 items-center justify-center shadow-sm mr-3"
            onPress={() => router.push('/inseminar')}
          >
            <View className="bg-white/20 w-20 h-20 rounded-full items-center justify-center mb-4">
               <Ionicons name="medical-outline" size={44} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <Text className="text-white font-bold text-lg">Inseminar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-1 bg-white rounded-3xl py-10 px-4 items-center justify-center shadow-sm ml-3"
            onPress={() => router.push('/estoque')}
          >
            <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
               <Ionicons name="server-outline" size={44} color="#1B5E20" />
            </View>
            <Text className="text-gray-900 font-bold text-center text-lg">Estoque rápido</Text>
          </TouchableOpacity>
        </View>

        {/* Linha 2 */}
        <View className="flex-row justify-between mb-6">
          <TouchableOpacity 
            className="flex-1 bg-white rounded-3xl py-10 px-4 items-center justify-center shadow-sm mr-3"
            onPress={() => router.push('/entrada-estoque')}
          >
            <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
               <Ionicons name="add" size={44} color="#1B5E20" />
            </View>
            <Text className="text-gray-900 font-bold text-center text-lg">Nova Entrada</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-1 bg-white rounded-3xl py-10 px-4 items-center justify-center shadow-sm ml-3"
            onPress={() => router.push('/historico')}
          >
            <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
               <Ionicons name="time-outline" size={44} color="#1B5E20" />
            </View>
            <Text className="text-gray-900 font-bold text-center text-lg">Histórico</Text>
          </TouchableOpacity>
        </View>

        {/* Linha 3 */}
        <View className="flex-row justify-between mb-2">
          <TouchableOpacity 
            className="flex-1 bg-white rounded-3xl py-10 px-4 items-center justify-center shadow-sm relative mr-3"
            onPress={() => router.push('/compras')}
          >
            {comprasAlertaCount > 0 && (
              <View className="absolute top-4 right-4 bg-danger rounded-full w-8 h-8 items-center justify-center z-10 border-2 border-white shadow-sm">
                <Text className="text-white text-sm font-bold">{comprasAlertaCount}</Text>
              </View>
            )}
            <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
               <Ionicons name="cart-outline" size={44} color="#1B5E20" />
            </View>
            <Text className="text-gray-900 font-bold text-center text-lg">Compras</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-1 bg-white rounded-3xl py-10 px-4 items-center justify-center shadow-sm ml-3"
            onPress={() => router.push('/configuracoes')}
          >
            <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
               <Ionicons name="settings-outline" size={44} color="#1B5E20" />
            </View>
            <Text className="text-gray-900 font-bold text-center text-lg">Ajustes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Alertas Urgentes */}
      <View className="mt-4 mb-8">
        <View className="flex-row items-center mb-4">
           <Ionicons name="warning-outline" size={24} color="#D32F2F" />
           <Text className="text-gray-900 font-bold text-xl ml-2">Alertas Urgentes</Text>
        </View>
        {tourosEmAlerta.length === 0 ? (
          <Text className="text-gray-500 text-base italic ml-1">Nenhum touro abaixo do estoque mínimo.</Text>
        ) : (
          <>
            {tourosEmAlerta.map(touro => (
               <View key={touro.id} className="bg-white rounded-3xl p-5 shadow-sm flex-row justify-between items-center mb-3">
                 <View>
                   <Text className="font-bold text-gray-900 text-lg">{touro.nome}</Text>
                   <Text className="text-gray-500 text-sm">{touro.raca} · {touro.codigoRegistro || '0000'}</Text>
                 </View>
                 <View className="bg-danger rounded-full w-10 h-10 items-center justify-center">
                   <Text className="text-white font-bold">{touro.totalConvencional + touro.totalSexado}</Text>
                 </View>
               </View>
            ))}
            <TouchableOpacity 
              onPress={() => router.push('/compras')}
              className="mt-2 py-2 items-center"
            >
              <Text className="text-primary font-bold text-base underline">Ver lista de compras</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      </ScrollView>

      {/* Modal Estoque Atual */}
      <Modal visible={modalVisivel} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface-background rounded-t-3xl h-[85%] p-4 pt-6">
            <View className="flex-row justify-between items-center mb-6 px-2">
              <Text className="text-3xl font-bold text-primary-dark">Estoque atual</Text>
              <TouchableOpacity onPress={() => setModalVisivel(false)} className="p-2 border border-gray-300 rounded-full">
                <Ionicons name="close" size={20} color="#1B5E20" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={touros}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row justify-between items-center"
                  onPress={() => {
                    setModalVisivel(false);
                    router.push({ pathname: '/estoque', params: { touroId: item.id } });
                  }}
                >
                  <View>
                    <Text className="font-bold text-lg text-gray-900">{item.nome}</Text>
                    <Text className="text-gray-500 text-sm">{item.raca} · {item.codigoRegistro || '0000'}</Text>
                  </View>
                  <View className="flex-row">
                    <View className="bg-primary-dark px-3 py-1.5 rounded-lg mr-2">
                      <Text className="text-white font-bold text-sm">C {item.totalConvencional}</Text>
                    </View>
                    <View className="bg-primary/20 px-3 py-1.5 rounded-lg">
                      <Text className="text-primary-dark font-bold text-sm">S {item.totalSexado}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
