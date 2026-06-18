import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { db } from '../src/database';
import { touro, loteSemen, inseminacao } from '../src/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { useAuthStore } from '../src/store';
import * as FileSystem from 'expo-file-system/legacy';
import RacaSelectModal from './RacaSelectModal';
import { isKnownBreed } from '../src/constants/breeds';

interface EditTouroModalProps {
  visible: boolean;
  onClose: () => void;
  touroId: string;
  onSaveSuccess: () => void;
}

export default function EditTouroModal({ visible, onClose, touroId, onSaveSuccess }: EditTouroModalProps) {
  const authConta = useAuthStore((state: any) => state.conta);
  const isPrestador = authConta?.perfil === 'PRESTADOR';

  const [nome, setNome] = useState('');
  const [raca, setRaca] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [racaModalVisible, setRacaModalVisible] = useState(false);

  type LoteState = { id?: string; qtd: string; valor: string; codigo: string; caneca: string; botijao: string };
  const [lotes, setLotes] = useState<Record<string, LoteState>>({
    CONVENCIONAL: { qtd: '0', valor: '0', codigo: '', caneca: '', botijao: '' },
    SEXADO_MACHO: { qtd: '0', valor: '0', codigo: '', caneca: '', botijao: '' },
    SEXADO_FEMEA: { qtd: '0', valor: '0', codigo: '', caneca: '', botijao: '' },
  });

  useEffect(() => {
    if (visible && touroId) {
      carregarDadosTouro();
    }
  }, [visible, touroId]);

  const carregarDadosTouro = async () => {
    try {
      const t = await db.select().from(touro).where(eq(touro.id, touroId)).limit(1);
      if (t.length > 0) {
        setNome(t[0].nome);
        setRaca(t[0].raca || '');
        setEmpresa(t[0].empresaFornecedora || '');
        setFotoUri(t[0].fotoUrl || null);
      }

      const l = await db.select().from(loteSemen).where(and(eq(loteSemen.touroId, touroId), isNull(loteSemen.deletedAt)));
      
      const newLotes: Record<string, LoteState> = {
        CONVENCIONAL: { qtd: '0', valor: '0', codigo: '', caneca: '', botijao: '' },
        SEXADO_MACHO: { qtd: '0', valor: '0', codigo: '', caneca: '', botijao: '' },
        SEXADO_FEMEA: { qtd: '0', valor: '0', codigo: '', caneca: '', botijao: '' },
      };

      l.forEach((lote: any) => {
        if (newLotes[lote.tipo]) {
           newLotes[lote.tipo] = {
             id: lote.id,
             qtd: String(lote.quantidade),
             valor: String(lote.valorUnitario || 0),
             codigo: lote.codigoPalheta || '',
             caneca: lote.caneca || '',
             botijao: lote.botijao || ''
           };
        }
      });

      setLotes(newLotes);

    } catch (error) {
      console.error('Erro ao carregar touro:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do touro.');
    }
  };

  const updateLote = (tipo: string, field: keyof LoteState, value: string) => {
    setLotes(prev => ({ ...prev, [tipo]: { ...prev[tipo], [field]: value } }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = uri.split('/').pop() || `foto-updated.jpg`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      try {
        await FileSystem.copyAsync({ from: uri, to: newPath });
        setFotoUri(newPath);
      } catch (e) {
        console.error('Error saving image:', e);
        setFotoUri(uri);
      }
    }
  };

  const handleSalvar = async () => {
    if (!nome || !raca) {
      Alert.alert('Erro', 'Preencha o nome e a raça do touro.');
      return;
    }

    try {
      const timestamp = new Date().toISOString();

      await db.update(touro).set({
        nome,
        raca,
        empresaFornecedora: empresa,
        fotoUrl: fotoUri,
        updatedAt: timestamp,
        isDirty: true,
      }).where(eq(touro.id, touroId));

      const types = ['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA'];
      for (const tipo of types) {
        const data = lotes[tipo];
        const qtdNum = Number(data.qtd) || 0;
        const valorFormatado = data.valor.replace(',', '.');
        const valorUnitario = isPrestador ? (Number(valorFormatado) || 0) : (authConta?.valorPadraoCon || 0);

        if (data.id) {
          await db.update(loteSemen).set({
            quantidade: qtdNum,
            valorUnitario,
            codigoPalheta: data.codigo,
            caneca: data.caneca,
            botijao: data.botijao,
            updatedAt: timestamp,
            isDirty: true,
          }).where(eq(loteSemen.id, data.id));
        } else if (qtdNum > 0) {
           // Should ideally insert if a new type is added, but keeping it simple for edit
           console.log("Not implemented: Insert new lot type on edit.");
        }
      }

      Alert.alert('Sucesso', 'Touro atualizado com sucesso!');
      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar touro:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o touro.');
    }
  };

  const handleExcluir = () => {
    Alert.alert(
      'Excluir Touro',
      'Tem certeza que deseja excluir este touro? O histórico de inseminações será mantido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const timestamp = new Date().toISOString();
              await db.update(touro).set({
                deletedAt: timestamp,
                isDirty: true
              }).where(eq(touro.id, touroId));
              
              Alert.alert('Sucesso', 'Touro excluído com sucesso.');
              onSaveSuccess();
              onClose();
            } catch (error) {
               console.error('Erro ao excluir:', error);
               Alert.alert('Erro', 'Não foi possível excluir.');
            }
          }
        }
      ]
    );
  };

  const renderLoteCard = (tipo: string, title: string, icon: string = '') => {
    const data = lotes[tipo];
    return (
      <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <Text className="font-bold text-gray-900 text-lg mb-4">{title} {icon}</Text>
        
        <View className="flex-row justify-between mb-4">
          <View className={`flex-1 ${isPrestador ? 'mr-3' : ''}`}>
            <Text className="text-gray-700 font-medium mb-1">Quantidade</Text>
            <TextInput 
              className="bg-surface-background p-3 rounded-lg border border-gray-200 text-gray-900"
              keyboardType="numeric"
              placeholder="0"
              value={data.qtd}
              onChangeText={val => updateLote(tipo, 'qtd', val)}
            />
          </View>
          {isPrestador && (
            <View className="flex-1 ml-3">
              <Text className="text-gray-700 font-medium mb-1">Valor (R$)</Text>
              <TextInput 
                className="bg-surface-background p-3 rounded-lg border border-gray-200 text-gray-900"
                keyboardType="numeric"
                placeholder="0,00"
                value={data.valor}
                onChangeText={val => updateLote(tipo, 'valor', val)}
              />
            </View>
          )}
        </View>

        <Text className="text-gray-700 font-medium mb-1">Código/Registro da Palheta</Text>
        <TextInput 
          className="bg-surface-background p-3 rounded-lg border border-gray-200 mb-4 text-gray-900"
          value={data.codigo}
          onChangeText={val => updateLote(tipo, 'codigo', val)}
        />

        <View className="flex-row justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-gray-700 font-medium mb-1">Caneca</Text>
            <TextInput 
              className="bg-surface-background p-3 rounded-lg border border-gray-200 text-gray-900"
              placeholder="Ex: 01"
              value={data.caneca}
              onChangeText={val => updateLote(tipo, 'caneca', val)}
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-gray-700 font-medium mb-1">Botijão</Text>
            <TextInput 
              className="bg-surface-background p-3 rounded-lg border border-gray-200 text-gray-900"
              placeholder="Ex: A1"
              value={data.botijao}
              onChangeText={val => updateLote(tipo, 'botijao', val)}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-surface-background rounded-t-3xl h-[90%] p-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-primary-dark">Editar Touro</Text>
            <TouchableOpacity onPress={onClose} className="p-2 border border-gray-300 rounded-full">
              <Ionicons name="close" size={20} color="#1B5E20" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
              <View className="flex-row items-center mb-6">
                <TouchableOpacity 
                  className="w-24 h-24 rounded-xl bg-surface-background border-2 border-dashed border-gray-300 items-center justify-center overflow-hidden"
                  onPress={pickImage}
                >
                  {fotoUri ? (
                    <Image source={{ uri: fotoUri }} className="w-full h-full" />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
                      <Text className="text-gray-400 text-xs mt-1">Foto</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text className="text-gray-500 ml-4 flex-1">Toque para trocar a foto</Text>
              </View>

              <Text className="text-gray-900 font-bold mb-2">Nome do Touro *</Text>
              <TextInput className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-4 text-gray-900" value={nome} onChangeText={setNome} />
              
              <Text className="text-gray-900 font-bold mb-2">Raça *</Text>
              <TouchableOpacity 
                className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-4 flex-row justify-between items-center"
                onPress={() => setRacaModalVisible(true)}
              >
                <Text className={raca && raca !== 'Outra (Digitar...)' ? "text-gray-900" : "text-gray-400"}>
                  {raca && raca !== 'Outra (Digitar...)' ? raca : "Selecionar raça"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {(raca === 'Outra (Digitar...)' || (raca !== '' && !isKnownBreed(raca))) && (
                <TextInput 
                  className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-4 text-gray-900" 
                  placeholder="Digite o nome da raça" 
                  value={raca === 'Outra (Digitar...)' ? '' : raca} 
                  onChangeText={setRaca} 
                  autoFocus
                />
              )}
              
              <Text className="text-gray-900 font-bold mb-2">Central/Empresa fornecedora</Text>
              <TextInput className="bg-surface-background p-4 rounded-xl border border-gray-200 text-gray-900" value={empresa} onChangeText={setEmpresa} />
            </View>

            {renderLoteCard('CONVENCIONAL', 'Convencional')}
            {renderLoteCard('SEXADO_MACHO', 'Sexado', '♂ (Macho)')}
            {renderLoteCard('SEXADO_FEMEA', 'Sexado', '♀ (Fêmea)')}

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

      <RacaSelectModal 
        visible={racaModalVisible}
        onClose={() => setRacaModalVisible(false)}
        racaSelecionada={raca}
        onSelect={setRaca}
      />
    </Modal>
  );
}
