import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../src/database';
import { loteSemen, inseminacao } from '../src/database/schema';
import { eq } from 'drizzle-orm';
import { useAuthStore } from '../src/store';
import { v4 as uuidv4 } from 'uuid';
import { SyncEngine } from '../src/services/syncEngine';

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
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [valorCobrado, setValorCobrado] = useState('');
  
  const isPrestador = authConta?.perfil === 'PRESTADOR';

  // Seleciona o primeiro lote com saldo disponível por padrão
  useEffect(() => {
    if (visible && lotes.length > 0) {
      const loteDisponivel = lotes.find(l => l.quantidade > 0);
      if (loteDisponivel) {
        setSelectedLoteId(loteDisponivel.id);
        setQuantidade(1);
      } else {
        setSelectedLoteId(null);
      }
    }
  }, [visible, lotes]);

  const handleConfirmar = async () => {
    if (!authUser || !authConta || !selectedLoteId) return;

    const lote = lotes.find(l => l.id === selectedLoteId);
    if (!lote) return;

    if (lote.quantidade < quantidade) {
      Alert.alert('Aviso', `Estoque insuficiente. Saldo atual: ${lote.quantidade} dose(s).`);
      return;
    }

    setSaving(true);
    try {
      const isoDate = new Date().toISOString();

      // Registra N inseminações
      for (let i = 0; i < quantidade; i++) {
        await db.insert(inseminacao).values({
          id: uuidv4(),
          contaId: authConta.id,
          touroId: lote.touroId,
          loteSemenId: lote.id,
          usuarioId: authUser.id,
          clienteId: null, // Baixa rápida não tem cliente
          identificacaoVaca: '',
          valorCobrado: Number(valorCobrado) || 0,
          dataInseminacao: isoDate,
          isDirty: true,
          createdAt: isoDate,
          updatedAt: isoDate,
        });
      }

      const novaQtd = lote.quantidade - quantidade;
      await db.update(loteSemen)
        .set({
          quantidade: novaQtd >= 0 ? novaQtd : 0,
          updatedAt: isoDate,
          isDirty: true,
        })
        .where(eq(loteSemen.id, lote.id));

      Alert.alert('Sucesso', `${quantidade} dose(s) aplicada(s) com sucesso!`);
      onSaveSuccess();
      onClose();
      SyncEngine.sync();
    } catch (e) {
      console.error('Erro na baixa rápida:', e);
      Alert.alert('Erro', 'Não foi possível registrar a aplicação.');
    } finally {
      setSaving(false);
    }
  };

  const getCardStyle = (tipo: string, isSelected: boolean) => {
    const isConv = tipo === 'CONVENCIONAL';
    const isMacho = tipo === 'SEXADO_MACHO';
    
    let baseStyle = 'border-2 rounded-2xl p-4 w-[30%] items-center justify-center';
    
    if (isConv) {
      return `${baseStyle} ${isSelected ? 'bg-primary-dark border-primary-dark shadow-md' : 'bg-green-50 border-green-200'}`;
    }
    if (isMacho) {
      return `${baseStyle} ${isSelected ? 'bg-blue-500 border-blue-500 shadow-md' : 'bg-blue-100 border-blue-200'}`;
    }
    return `${baseStyle} ${isSelected ? 'bg-pink-500 border-pink-500 shadow-md' : 'bg-pink-100 border-pink-200'}`;
  };

  const getTextColor = (tipo: string, isSelected: boolean) => {
    if (isSelected) return 'text-white';
    
    const isConv = tipo === 'CONVENCIONAL';
    const isMacho = tipo === 'SEXADO_MACHO';
    
    if (isConv) return 'text-green-800';
    if (isMacho) return 'text-blue-800';
    return 'text-pink-800';
  };

  const renderLoteCard = (lote: any) => {
    const isConv = lote.tipo === 'CONVENCIONAL';
    const isMacho = lote.tipo === 'SEXADO_MACHO';
    
    const labelMain = isConv ? 'Convencional' : isMacho ? 'Sexado ♂' : 'Sexado ♀';
    const disabled = lote.quantidade <= 0;
    const isSelected = selectedLoteId === lote.id;

    return (
      <TouchableOpacity 
        key={lote.id}
        disabled={disabled || saving}
        onPress={() => setSelectedLoteId(lote.id)}
        className={`${getCardStyle(lote.tipo, isSelected)} ${disabled ? 'opacity-40' : ''}`}
      >
        <Text className={`font-bold text-sm text-center mb-1 ${getTextColor(lote.tipo, isSelected)}`}>{labelMain}</Text>
        <Text className={`text-xs ${getTextColor(lote.tipo, isSelected)}`}>{lote.quantidade} dose(s)</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View className="flex-1 justify-center bg-black/50 p-4">
        <View className="bg-surface-background rounded-3xl p-6 shadow-xl border border-gray-100">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-2xl font-extrabold text-gray-900 tracking-tight">Registrar aplicação</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={24} color="#4B5563" />
            </TouchableOpacity>
          </View>
          
          <Text className="text-gray-600 mb-6 text-base">
            Registrar aplicação de sêmen do Touro <Text className="font-extrabold text-gray-900">{touroNome}</Text>?
          </Text>

          {lotes.length === 0 ? (
             <Text className="text-center text-gray-500 my-4">Nenhum estoque disponível.</Text>
          ) : (
            <View className="flex-row justify-between gap-2 mb-8">
              {lotes.map(renderLoteCard)}
            </View>
          )}

          {selectedLoteId && (
            <View className="flex-row items-center justify-between bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
              <Text className="font-bold text-gray-700 text-base">Quantidade</Text>
              <View className="flex-row items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                <TouchableOpacity 
                  onPress={() => setQuantidade(Math.max(1, quantidade - 1))}
                  className="w-10 h-10 items-center justify-center bg-gray-50 rounded-lg active:bg-gray-100"
                >
                  <Ionicons name="remove" size={20} color="#4B5563" />
                </TouchableOpacity>
                <Text className="font-bold text-lg text-gray-900 w-12 text-center">{quantidade}</Text>
                <TouchableOpacity 
                  onPress={() => {
                     const lote = lotes.find(l => l.id === selectedLoteId);
                     if (lote && quantidade < lote.quantidade) {
                        setQuantidade(quantidade + 1);
                     }
                  }}
                  className="w-10 h-10 items-center justify-center bg-gray-50 rounded-lg active:bg-gray-100"
                >
                  <Ionicons name="add" size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {selectedLoteId && isPrestador && (
            <View className="mb-8">
              <Text className="font-bold text-gray-700 text-base mb-2">Valor Cobrado (R$ / dose)</Text>
              <TextInput 
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-gray-900 shadow-sm" 
                keyboardType="numeric"
                placeholder="Ex: 50.00"
                value={valorCobrado} 
                onChangeText={setValorCobrado} 
              />
            </View>
          )}

          <View className="flex-row justify-end gap-3 mt-2">
            <TouchableOpacity 
              onPress={onClose}
              className="px-6 py-3.5 rounded-full border border-gray-200 bg-white"
            >
              <Text className="font-bold text-gray-900 text-base">Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              disabled={saving || !selectedLoteId}
              onPress={handleConfirmar}
              className={`px-8 py-3.5 rounded-full ${(!selectedLoteId || saving) ? 'bg-gray-300' : 'bg-primary-dark'} shadow-sm shadow-primary-200`}
            >
              <Text className="font-bold text-white text-base">Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
