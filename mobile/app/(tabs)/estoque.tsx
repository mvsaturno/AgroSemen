import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { db } from '../../src/database';
import { touro, loteSemen } from '../../src/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

type TouroComLotes = {
  id: string;
  nome: string;
  raca: string;
  lotes: any[];
};

export default function EstoqueScreen() {
  const [touros, setTouros] = useState<TouroComLotes[]>([]);
  const [busca, setBusca] = useState('');
  const router = useRouter();

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

  const renderBadge = (tipo: string, qtd: number) => {
    const label = tipo === 'CONVENCIONAL' ? 'C' : tipo === 'SEXADO_MACHO' ? '♂S' : '♀S';
    const color = tipo === 'CONVENCIONAL' ? 'bg-gray-200 text-gray-800' : 
                  tipo === 'SEXADO_MACHO' ? 'bg-blue-100 text-blue-800' : 
                  'bg-pink-100 text-pink-800';
    return (
      <View key={tipo} className={`flex-row items-center px-3 py-1.5 rounded-xl mr-2 ${color.split(' ')[0]}`}>
        <Text className={`text-sm font-bold ${color.split(' ')[1]}`}>{label}: {qtd}</Text>
      </View>
    );
  };

  const tourosFiltrados = touros.filter(t => 
    t.nome.toLowerCase().includes(busca.toLowerCase()) || 
    t.raca.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <View className="flex-1 bg-surface-background p-6">
      <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-gray-100">
        <TextInput
          placeholder="Buscar por nome ou raça..."
          value={busca}
          onChangeText={setBusca}
          className="px-2 text-base text-gray-900"
        />
      </View>

      <FlatList
        data={tourosFiltrados}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            className="bg-white p-6 rounded-2xl mb-4 shadow-sm border border-gray-100 flex-row justify-between items-center"
            onPress={() => router.push({ pathname: '/inseminar', params: { touroId: item.id } })}
          >
            <View>
              <Text className="font-bold text-xl text-gray-900 mb-1">{item.nome}</Text>
              <Text className="text-gray-500 text-base mb-3">{item.raca}</Text>
              <View className="flex-row">
                {item.lotes.map(l => renderBadge(l.tipo, l.quantidade))}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
