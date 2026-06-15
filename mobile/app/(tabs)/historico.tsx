import React, { useState, useCallback } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { db } from '../../src/database';
import { inseminacao, touro, cliente } from '../../src/database/schema';
import { useAuthStore } from '../../src/store';
import { isNull } from 'drizzle-orm';

export default function HistoricoScreen() {
  const authConta = useAuthStore(state => state.conta);
  const isPrestador = authConta?.perfil === 'PRESTADOR';
  const [registros, setRegistros] = useState<any[]>([]);

  const formatISOToLocale = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
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

  return (
    <View className="flex-1 bg-surface-background p-6">
      <Text className="text-2xl font-bold text-primary-dark mb-6">Histórico de Inseminações</Text>

      <FlatList
        data={registros}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View className="bg-white p-6 rounded-2xl mb-4 shadow-sm border border-gray-100">
            <View className="flex-row justify-between mb-3">
              <Text className="font-bold text-xl text-gray-900">{item.touroNome}</Text>
              {isPrestador && (
                <Text className="text-primary font-bold text-xl">R$ {Number(item.valorCobrado || 0).toFixed(2)}</Text>
              )}
            </View>
            <Text className="text-gray-700 text-base mb-1.5">Cliente: {item.clienteNome}</Text>
            <Text className="text-gray-700 text-base mb-1.5">Vaca: {item.identificacaoVaca || 'Não informada'}</Text>
            <View className="flex-row justify-between mt-3">
              <Text className="text-gray-500 text-sm">
                {formatISOToLocale(item.dataInseminacao)}
              </Text>
              {item.isDirty && (
                <Text className="text-warning font-bold text-sm">Pendente Sincronização</Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}
