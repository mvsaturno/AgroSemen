import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../src/database';
import { loteSemen, inseminacao } from '../src/database/schema';
import { eq } from 'drizzle-orm';
import { useAuthStore } from '../src/store';
import { v4 as uuidv4 } from 'uuid';

interface BaixaRapidaModalProps {
  visible: boolean;
  onClose: () => void;
  touroNome: string;
  lotes: any[];
  onSaveSuccess: () => void;
}

export default function BaixaRapidaModal({ visible, onClose, touroNome, lotes, onSaveSuccess }: BaixaRapidaModalProps) {
  const authUser = useAuthStore((state: any) => state.user);
  const authConta = useAuthStore((state: any) => state.conta);

  const [saving, setSaving] = useState(false);

  const handleBaixa = async (lote: any) => {
    if (!authUser || !authConta) return;
    
    if (lote.quantidade <= 0) {
      Alert.alert('Aviso', 'Não há estoque suficiente deste tipo.');
      return;
    }

    setSaving(true);
    try {
      const isoDate = new Date().toISOString();

      await db.insert(inseminacao).values({
        id: uuidv4(),
        contaId: authConta.id,
        touroId: lote.touroId,
        loteSemenId: lote.id,
        usuarioId: authUser.id,
        clienteId: null, // Baixa rápida não tem cliente
        identificacaoVaca: '',
        valorCobrado: 0,
        dataInseminacao: isoDate,
        isDirty: true,
        createdAt: isoDate,
        updatedAt: isoDate,
      });

      const novaQtd = lote.quantidade - 1;
      await db.update(loteSemen)
        .set({
          quantidade: novaQtd >= 0 ? novaQtd : 0,
          updatedAt: isoDate,
          isDirty: true,
        })
        .where(eq(loteSemen.id, lote.id));

      Alert.alert('Sucesso', 'Baixa registrada com sucesso!');
      onSaveSuccess();
      onClose();
    } catch (e) {
      console.error('Erro na baixa rápida:', e);
      Alert.alert('Erro', 'Não foi possível registrar a baixa rápida.');
    } finally {
      setSaving(false);
    }
  };

  const renderLoteButton = (lote: any) => {
    const isConv = lote.tipo === 'CONVENCIONAL';
    const isMacho = lote.tipo === 'SEXADO_MACHO';
    
    const bgColor = isConv ? 'bg-green-100' : isMacho ? 'bg-blue-100' : 'bg-pink-100';
    const borderColor = isConv ? 'border-green-300' : isMacho ? 'border-blue-300' : 'border-pink-300';
    const textColor = isConv ? 'text-green-800' : isMacho ? 'text-blue-800' : 'text-pink-800';
    const label = isConv ? 'Convencional' : isMacho ? 'Sexado ♂ (Macho)' : 'Sexado ♀ (Fêmea)';
    
    const disabled = lote.quantidade <= 0;

    return (
      <TouchableOpacity 
        key={lote.id}
        disabled={disabled || saving}
        onPress={() => handleBaixa(lote)}
        className={`w-full p-4 rounded-xl border ${bgColor} ${borderColor} mb-3 flex-row justify-between items-center ${disabled ? 'opacity-50' : ''}`}
      >
        <Text className={`font-bold text-lg ${textColor}`}>{label}</Text>
        <View className="bg-white px-3 py-1 rounded-lg">
          <Text className={`font-bold ${textColor}`}>Saldo: {lote.quantidade}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View className="flex-1 justify-center bg-black/50 p-4">
        <View className="bg-surface-background rounded-2xl p-6 shadow-lg">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xl font-bold text-gray-900">Baixa Rápida</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#4B5563" />
            </TouchableOpacity>
          </View>
          
          <Text className="text-gray-500 mb-6 text-base">
            Registrar uso de <Text className="font-bold text-gray-800">{touroNome}</Text>. Qual tipo de sêmen foi utilizado?
          </Text>

          {lotes.length === 0 ? (
             <Text className="text-center text-gray-500 my-4">Nenhum estoque disponível.</Text>
          ) : (
             lotes.map(renderLoteButton)
          )}
        </View>
      </View>
    </Modal>
  );
}
