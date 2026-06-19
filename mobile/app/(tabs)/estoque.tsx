import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import EditTouroModal from '../../components/EditTouroModal';
import BaixaRapidaModal from '../../components/BaixaRapidaModal';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../src/database';
import { touro, loteSemen } from '../../src/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { SyncEngine } from '../../src/services/syncEngine';

type TouroComLotes = {
  id: string;
  nome: string;
  raca: string;
  fotoUrl: string | null;
  lotes: any[];
};

export default function EstoqueScreen() {
  const [touros, setTouros] = useState<TouroComLotes[]>([]);
  const [busca, setBusca] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTouroId, setEditingTouroId] = useState('');
  
  const [baixaModalVisible, setBaixaModalVisible] = useState(false);
  const [baixaTouro, setBaixaTouro] = useState<{nome: string, lotes: any[]} | null>(null);
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedRaca, setSelectedRaca] = useState('Todas');
  
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe(() => {
      console.log('[EstoqueScreen] Sync completed, reloading...');
      carregarEstoque();
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarEstoque();
    }, [])
  );

  const carregarEstoque = async () => {
    const todosTouros = await db.select().from(touro).where(isNull(touro.deletedAt));
    const todosLotes = await db.select().from(loteSemen).where(isNull(loteSemen.deletedAt));

    const agrupado = todosTouros.map(t => ({
      ...t,
      lotes: todosLotes.filter(l => l.touroId === t.id)
    })).filter(t => t.lotes.length > 0);

    setTouros(agrupado);
  };

  const renderBadge = (lote: any) => {
    const { tipo, quantidade, caneca, botijao } = lote;
    const label = tipo === 'CONVENCIONAL' ? 'C' : tipo === 'SEXADO_MACHO' ? '♂S' : '♀S';
    const color = tipo === 'CONVENCIONAL' ? 'bg-gray-200 text-gray-800' : 
                  tipo === 'SEXADO_MACHO' ? 'bg-blue-100 text-blue-800' : 
                  'bg-pink-100 text-pink-800';
                  
    let loc = '';
    if (caneca || botijao) {
      loc = ` (${caneca ? 'C:'+caneca : ''}${caneca && botijao ? ' ' : ''}${botijao ? 'B:'+botijao : ''})`;
    }

    return (
      <View key={lote.id} className={`flex-row items-center px-2 py-1 rounded-lg mr-2 mb-2 ${color.split(' ')[0]}`}>
        <Text className={`text-xs font-bold ${color.split(' ')[1]}`}>{label}: {quantidade}{loc}</Text>
      </View>
    );
  };

  const todasRacas = ['Todas', ...Array.from(new Set(touros.map(t => t.raca))).sort()];

  const tourosFiltrados = touros.filter(t => 
    (selectedRaca === 'Todas' || t.raca === selectedRaca) &&
    (t.nome.toLowerCase().includes(busca.toLowerCase()) || 
    t.raca.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <View className="flex-1 bg-surface-background p-4">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1 bg-white rounded-xl p-3 shadow-sm border border-gray-100 mr-2">
          <TextInput
            placeholder="Buscar por nome ou raça..."
            value={busca}
            onChangeText={setBusca}
            className="px-2 text-base text-gray-900"
          />
        </View>
        <TouchableOpacity 
          className="bg-white p-3 rounded-xl shadow-sm border border-gray-100"
          onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        >
          <Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={24} color="#1B5E20" />
        </TouchableOpacity>
      </View>

      <View className="mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {todasRacas.map(raca => (
            <TouchableOpacity 
              key={raca}
              onPress={() => setSelectedRaca(raca)}
              className={`px-4 py-2 rounded-full mr-2 border ${selectedRaca === raca ? 'bg-primary border-primary' : 'bg-white border-gray-200 shadow-sm'}`}
            >
              <Text className={`font-bold ${selectedRaca === raca ? 'text-white' : 'text-gray-600'}`}>{raca}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        key={viewMode}
        data={tourosFiltrados}
        keyExtractor={item => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? { justifyContent: 'space-between' } : undefined}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity 
            className={`bg-white rounded-2xl mb-4 shadow-sm border border-gray-100 overflow-hidden ${viewMode === 'grid' ? 'w-[48%]' : 'w-full flex-row items-center p-4'}`}
            onPress={() => router.push({ pathname: '/inseminar', params: { touroId: item.id } })}
          >
            {item.fotoUrl ? (
              <Image 
                source={{ uri: item.fotoUrl }} 
                className={`${viewMode === 'grid' ? 'w-full h-32' : 'w-20 h-20 rounded-xl mr-4'}`} 
                resizeMode="cover" 
              />
            ) : (
              <View className={`${viewMode === 'grid' ? 'w-full h-32' : 'w-20 h-20 rounded-xl mr-4'} bg-gray-100 items-center justify-center`}>
                <Ionicons name="image-outline" size={32} color="#9CA3AF" />
              </View>
            )}

            <View className={`${viewMode === 'grid' ? 'p-3' : 'flex-1'} flex-col justify-between`}>
              <View>
                <Text className="font-bold text-lg text-gray-900 mb-0.5">{item.nome}</Text>
                <Text className="text-gray-500 text-sm mb-2">{item.raca}</Text>
                <View className="flex-row flex-wrap">
                  {item.lotes.map(l => renderBadge(l))}
                </View>
              </View>
              
              <View className={`flex-row justify-end items-center mt-2 ${viewMode === 'grid' ? 'border-t border-gray-100 pt-2' : ''}`}>
                <TouchableOpacity 
                  className="w-10 h-10 rounded-full border border-primary/20 items-center justify-center bg-primary/10 mr-2"
                  onPress={() => {
                    setBaixaTouro({ nome: item.nome, lotes: item.lotes });
                    setBaixaModalVisible(true);
                  }}
                >
                  <Ionicons name="color-fill" size={18} color="#1B5E20" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  className="w-10 h-10 rounded-full border border-gray-200 items-center justify-center bg-surface-background"
                  onPress={() => {
                    setEditingTouroId(item.id);
                    setModalVisible(true);
                  }}
                >
                  <Ionicons name="pencil-outline" size={18} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {baixaTouro ? (
        <BaixaRapidaModal 
          visible={baixaModalVisible} 
          onClose={() => setBaixaModalVisible(false)} 
          touroNome={baixaTouro.nome}
          lotes={baixaTouro.lotes}
          onSaveSuccess={() => carregarEstoque()}
        />
      ) : null}

      {editingTouroId ? (
        <EditTouroModal 
          visible={modalVisible} 
          onClose={() => setModalVisible(false)} 
          touroId={editingTouroId} 
          onSaveSuccess={() => carregarEstoque()} 
        />
      ) : null}
    </View>
  );
}
