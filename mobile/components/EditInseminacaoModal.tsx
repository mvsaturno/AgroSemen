import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../src/database';
import { inseminacao, loteSemen, cliente, touro } from '../src/database/schema';
import { eq, isNull } from 'drizzle-orm';
import { useAuthStore } from '../src/store';
import { Picker } from '@react-native-picker/picker';
import { SyncEngine } from '../src/services/syncEngine';

interface EditInseminacaoModalProps {
  visible: boolean;
  onClose: () => void;
  inseminacaoId: string;
  onSaveSuccess: () => void;
}

export default function EditInseminacaoModal({ visible, onClose, inseminacaoId, onSaveSuccess }: EditInseminacaoModalProps) {
  const authConta = useAuthStore((state: any) => state.conta);
  const isPrestador = authConta?.perfil === 'PRESTADOR';

  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [identificacaoVaca, setIdentificacaoVaca] = useState('');
  const [valorCobrado, setValorCobrado] = useState('');
  const [dataInseminacao, setDataInseminacao] = useState('');
  
  // Para exibir como read-only
  const [touroNome, setTouroNome] = useState('');
  const [loteIdOriginal, setLoteIdOriginal] = useState('');

  useEffect(() => {
    if (visible && inseminacaoId) {
      carregarDados();
    }
  }, [visible, inseminacaoId]);

  const parseDateToLocale = (isoStr: string) => {
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

  const parseLocaleToISO = (dateStr: string): string => {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const d = new Date(dateStr);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    }
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today.toISOString();
  };

  const carregarDados = async () => {
    try {
      const cList = await db.select().from(cliente).where(isNull(cliente.deletedAt));
      setClientes(cList);

      const ins = await db.select().from(inseminacao).where(eq(inseminacao.id, inseminacaoId)).limit(1);
      if (ins.length > 0) {
        const item = ins[0];
        setSelectedCliente(item.clienteId || '');
        setIdentificacaoVaca(item.identificacaoVaca || '');
        setValorCobrado(item.valorCobrado ? String(item.valorCobrado) : '0');
        setDataInseminacao(parseDateToLocale(item.dataInseminacao));
        setLoteIdOriginal(item.loteSemenId);
        
        const tInfo = await db.select().from(touro).where(eq(touro.id, item.touroId)).limit(1);
        const lInfo = await db.select().from(loteSemen).where(eq(loteSemen.id, item.loteSemenId)).limit(1);
        
        let label = 'Desconhecido';
        if (tInfo.length > 0) {
          let tipoStr = 'Convencional';
          if (lInfo.length > 0) {
            if (lInfo[0].tipo === 'SEXADO_MACHO') tipoStr = 'Sexado ♂';
            if (lInfo[0].tipo === 'SEXADO_FEMEA') tipoStr = 'Sexado ♀';
          }
          label = `${tInfo[0].nome} (${tipoStr})`;
        }
        setTouroNome(label);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar o registro.');
    }
  };

  const handleSalvar = async () => {
    try {
      const timestamp = new Date().toISOString();
      await db.update(inseminacao).set({
        clienteId: selectedCliente || null,
        identificacaoVaca,
        valorCobrado: Number(valorCobrado) || 0,
        dataInseminacao: parseLocaleToISO(dataInseminacao),
        updatedAt: timestamp,
        isDirty: true
      }).where(eq(inseminacao.id, inseminacaoId));

      Alert.alert('Sucesso', 'Registro atualizado.');
      onSaveSuccess();
      onClose();
      SyncEngine.sync();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível atualizar o registro.');
    }
  };

  const handleExcluir = () => {
    Alert.alert(
      'Atenção!',
      'Tem certeza que deseja excluir esta inseminação? O saldo da dose de sêmen utilizada será devolvido ao estoque automaticamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir e Devolver Dose',
          style: 'destructive',
          onPress: async () => {
            try {
              const timestamp = new Date().toISOString();
              
              // 1. Marca como excluído
              await db.update(inseminacao).set({
                deletedAt: timestamp,
                isDirty: true
              }).where(eq(inseminacao.id, inseminacaoId));

              // 2. Restaura o estoque (Dose + 1)
              const lote = await db.select().from(loteSemen).where(eq(loteSemen.id, loteIdOriginal)).limit(1);
              if (lote.length > 0) {
                await db.update(loteSemen).set({
                  quantidade: lote[0].quantidade + 1,
                  updatedAt: timestamp,
                  isDirty: true
                }).where(eq(loteSemen.id, loteIdOriginal));
              }

              Alert.alert('Sucesso', 'Registro excluído e saldo restaurado no estoque.');
              onSaveSuccess();
              onClose();
              SyncEngine.sync();
            } catch (error) {
              Alert.alert('Erro', 'Falha ao excluir registro.');
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-surface-background rounded-t-3xl h-[85%] p-6">
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-bold text-primary-dark">Editar Registro</Text>
              {touroNome ? (
                <Text className="text-gray-500 text-sm font-semibold mt-1">Touro: {touroNome}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} className="p-2 border border-gray-300 rounded-full">
              <Ionicons name="close" size={20} color="#1B5E20" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="bg-orange-50 p-4 rounded-xl border border-orange-200 mb-6">
               <Text className="text-orange-800 text-sm">
                 <Text className="font-bold">Aviso:</Text> Não é possível alterar o Touro ou o Tipo de sêmen para manter a integridade do estoque. Se selecionou a dose errada, exclua este registro abaixo e faça um novo.
               </Text>
            </View>

            <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
              <Text className="text-gray-900 font-bold mb-2">Cliente / Fazenda</Text>
              <View className="bg-surface-background rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <Picker
                  selectedValue={selectedCliente}
                  onValueChange={(itemValue) => setSelectedCliente(itemValue)}
                >
                  <Picker.Item label="Nenhum" value="" color="#9CA3AF" />
                  {clientes.map((c) => (
                    <Picker.Item key={c.id} label={c.nome} value={c.id} />
                  ))}
                </Picker>
              </View>

              <Text className="text-gray-900 font-bold mb-2">Identificação da Vaca</Text>
              <TextInput 
                className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-4 text-gray-900" 
                placeholder="Ex: Mimosa"
                value={identificacaoVaca} 
                onChangeText={setIdentificacaoVaca} 
              />
              
              <Text className="text-gray-900 font-bold mb-2">Data da Aplicação</Text>
              <TextInput 
                className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-4 text-gray-900" 
                placeholder="DD/MM/AAAA"
                value={dataInseminacao} 
                onChangeText={setDataInseminacao} 
              />

              {isPrestador && (
                <>
                  <Text className="text-gray-900 font-bold mb-2">Valor Cobrado (R$)</Text>
                  <TextInput 
                    className="bg-surface-background p-4 rounded-xl border border-gray-200 text-gray-900" 
                    keyboardType="numeric"
                    value={valorCobrado} 
                    onChangeText={setValorCobrado} 
                  />
                </>
              )}
            </View>

            <View className="flex-row justify-between items-center mt-2">
              <TouchableOpacity className="flex-1 bg-white border border-danger h-14 rounded-xl items-center justify-center mr-2" onPress={handleExcluir}>
                <View className="flex-row items-center">
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  <Text className="text-danger font-bold text-lg ml-2">Excluir</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-primary h-14 rounded-xl items-center justify-center ml-2" onPress={handleSalvar}>
                <Text className="text-white font-bold text-lg">Salvar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
