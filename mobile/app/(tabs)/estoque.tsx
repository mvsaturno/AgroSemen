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

  const renderLoteInfo = (lote: any) => {
    const { tipo, quantidade, caneca, botijao } = lote;
    const isConv = tipo === 'CONVENCIONAL';
    const isMacho = tipo === 'SEXADO_MACHO';
    
    const labelPrefix = isConv ? 'C' : isMacho ? '♂ S' : '♀ S';
    
    let locStr = '';
    if (caneca || botijao) {
      locStr = ` - ${caneca ? 'Caneca ' + caneca : ''}${caneca && botijao ? ' | ' : ''}${botijao ? 'Bot. ' + botijao : ''}`;
    }

    if (isConv) {
       return (
         <View key={lote.id} className="bg-primary-dark self-start px-3 py-1 rounded mb-1">
           <Text className="text-white font-extrabold text-xs">{labelPrefix} {quantidade}{locStr}</Text>
         </View>
       );
    }
    
    const textColor = isMacho ? 'text-blue-600' : 'text-pink-600';
    return (
      <View key={lote.id} className="mb-1 ml-1">
         <Text className={`font-extrabold text-xs ${textColor}`}>{labelPrefix} {quantidade}{locStr}</Text>
      </View>
    );
  };

  const todasRacas = ['Todas', ...Array.from(new Set(touros.map(t => t.raca))).sort()];

  const tourosFiltrados = touros.filter(t => 
    (selectedRaca === 'Todas' || t.raca === selectedRaca) &&
    (t.nome.toLowerCase().includes(busca.toLowerCase()) || 
    t.raca.toLowerCase().includes(busca.toLowerCase()))
  );

  const agrupadoPorRaca = tourosFiltrados.reduce((acc, touro) => {
    const raca = touro.raca || 'Sem Raça';
    if (!acc[raca]) acc[raca] = [];
    acc[raca].push(touro);
    return acc;
  }, {} as Record<string, TouroComLotes[]>);

  const racasOrdenadas = Object.keys(agrupadoPorRaca).sort();

  return (
    <View className="flex-1 bg-surface-background p-4">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <TextInput
            placeholder="Buscar por nome ou raça..."
            value={busca}
            onChangeText={setBusca}
            className="px-2 text-base text-gray-900"
          />
        </View>
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {racasOrdenadas.map((raca) => (
          <View key={raca} className="mb-6">
            <View className="bg-primary-dark py-2 px-4 rounded-t-lg mb-4 flex-row justify-between items-center">
              <Text className="text-white font-extrabold text-base uppercase">{raca}</Text>
              <Text className="text-white font-bold text-sm">{agrupadoPorRaca[raca].length} touro(s)</Text>
            </View>
            
            {agrupadoPorRaca[raca].map((item: any) => (
              <View key={item.id} className="bg-white rounded-2xl mb-6 shadow-sm border border-gray-100 overflow-hidden">
                {item.fotoUrl ? (
                  <Image source={{ uri: item.fotoUrl }} className="w-full h-64" resizeMode="cover" />
                ) : (
                  <View className="w-full h-40 bg-gray-100 items-center justify-center">
                    <Ionicons name="image-outline" size={48} color="#9CA3AF" />
                  </View>
                )}
                
                <View className="p-4">
                  <View className="flex-row justify-between items-start mb-2">
                    <View>
                      <Text className="font-extrabold text-xl text-gray-900 uppercase tracking-tight">{item.nome}</Text>
                      <Text className="text-gray-500 text-sm">{item.raca} · {item.lotes[0]?.codigoPalheta || '0000'}</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => {
                        setEditingTouroId(item.id);
                        setModalVisible(true);
                      }}
                      className="p-2"
                    >
                      <Ionicons name="pencil" size={20} color="#4B5563" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row justify-center mt-2 mb-6">
                    <TouchableOpacity 
                      className="flex-row items-center bg-white"
                      onPress={() => {
                        setBaixaTouro({ nome: item.nome, lotes: item.lotes });
                        setBaixaModalVisible(true);
                      }}
                    >
                      <Ionicons name="medical" size={24} color="#3B82F6" />
                      <Text className="text-blue-500 font-extrabold text-lg ml-2">APLICAR</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="mt-2">
                    {item.lotes.map((l: any) => renderLoteInfo(l))}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
        {tourosFiltrados.length === 0 && (
          <Text className="text-center text-gray-500 mt-10">Nenhum touro encontrado.</Text>
        )}
        <View className="h-10" />
      </ScrollView>

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
