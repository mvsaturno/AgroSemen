import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { db } from '../../src/database';
import { touro, loteSemen } from '../../src/database/schema';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { and, eq, isNull } from 'drizzle-orm';
import { useAuthStore } from '../../src/store';
import { Picker } from '@react-native-picker/picker';
import { v4 as uuidv4 } from 'uuid';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import RacaSelectModal from '../../components/RacaSelectModal';
import ImportCsvModal from '../../components/ImportCsvModal';
import { isKnownBreed } from '../../src/constants/breeds';

export default function EntradaEstoqueScreen() {
  const router = useRouter();
  const authConta = useAuthStore(state => state.conta);
  const isPrestador = authConta?.perfil === 'PRESTADOR';

  const [tab, setTab] = useState<'EXISTENTE' | 'NOVO'>('NOVO');
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [touros, setTouros] = useState<any[]>([]);
  const [selectedTouroId, setSelectedTouroId] = useState('');

  useFocusEffect(
    useCallback(() => {
      carregarTouros();
    }, [])
  );

  const carregarTouros = async () => {
    const data = await db.select().from(touro).where(isNull(touro.deletedAt));
    setTouros(data);
    if (data.length > 0) {
      setSelectedTouroId(data[0].id);
    }
  };
  
  // Touro Fields
  const [nome, setNome] = useState('');
  const [raca, setRaca] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [racaModalVisible, setRacaModalVisible] = useState(false);

  type LoteState = { qtd: string; valor: string; codigo: string; caneca: string; botijao: string };
  const [lotes, setLotes] = useState<Record<string, LoteState>>({
    CONVENCIONAL: { qtd: '', valor: '', codigo: '', caneca: '', botijao: '' },
    SEXADO_MACHO: { qtd: '', valor: '', codigo: '', caneca: '', botijao: '' },
    SEXADO_FEMEA: { qtd: '', valor: '', codigo: '', caneca: '', botijao: '' },
  });

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
      // Save locally to document directory so it persists offline
      const uri = result.assets[0].uri;
      const fileName = uri.split('/').pop() || `foto-${uuidv4()}.jpg`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      try {
        await FileSystem.copyAsync({ from: uri, to: newPath });
        setFotoUri(newPath);
      } catch (e) {
        console.error('Error saving image:', e);
        setFotoUri(uri); // fallback to original
      }
    }
  };

  const handleSalvar = async () => {
    if (!authConta) return;
    
    if (tab === 'NOVO' && (!nome || !raca)) {
      Alert.alert('Erro', 'Preencha o nome e a raça do touro.');
      return;
    }
    if (tab === 'EXISTENTE' && !selectedTouroId) {
      Alert.alert('Erro', 'Selecione um touro existente.');
      return;
    }

    try {
      const touroId = uuidv4();
      const timestamp = new Date().toISOString();

      // Ensure we are inside a try-catch for local db
      if (tab === 'NOVO') {
        await db.insert(touro).values({
          id: touroId,
          contaId: authConta.id,
          nome,
          raca,
          empresaFornecedora: empresa,
          fotoUrl: fotoUri,
          updatedAt: timestamp,
          isDirty: true,
        });
      }

      const types = ['CONVENCIONAL', 'SEXADO_MACHO', 'SEXADO_FEMEA'];
      for (const tipo of types) {
        const data = lotes[tipo];
        const qtdNum = Number(data.qtd);
        if (qtdNum > 0) {
          const valorFormatado = data.valor.replace(',', '.');
          const valorPadrao = tipo === 'CONVENCIONAL' ? authConta.valorPadraoCon : authConta.valorPadraoSex;
          const valorUnitario = isPrestador ? (Number(valorFormatado) || 0) : valorPadrao;
          
          const tId = tab === 'NOVO' ? touroId : selectedTouroId;
          const existingLot = await db.select()
            .from(loteSemen)
            .where(
              and(
                eq(loteSemen.touroId, tId),
                eq(loteSemen.tipo, tipo),
                eq(loteSemen.contaId, authConta.id),
                isNull(loteSemen.deletedAt)
              )
            )
            .limit(1);

          if (existingLot.length > 0) {
            // Incrementar lote existente localmente
            await db.update(loteSemen).set({
              quantidade: existingLot[0].quantidade + qtdNum,
              valorUnitario,
              codigoPalheta: data.codigo || existingLot[0].codigoPalheta,
              caneca: data.caneca || existingLot[0].caneca,
              botijao: data.botijao || existingLot[0].botijao,
              updatedAt: timestamp,
              isDirty: true,
            }).where(eq(loteSemen.id, existingLot[0].id));
          } else {
            // Criar novo lote localmente
            await db.insert(loteSemen).values({
              id: uuidv4(),
              touroId: tId,
              contaId: authConta.id,
              tipo,
              quantidade: qtdNum,
              valorUnitario,
              codigoPalheta: data.codigo,
              caneca: data.caneca,
              botijao: data.botijao,
              updatedAt: timestamp,
              isDirty: true,
            });
          }
        }
      }

      Alert.alert('Sucesso', 'Estoque adicionado com sucesso!');
      router.back();
    } catch (e) {
      console.error('Erro ao salvar no banco local:', e);
      Alert.alert('Erro', 'Não foi possível salvar o estoque. Tente novamente.');
    }
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
    <View className="flex-1 bg-surface-background">
      <View className="bg-primary pt-12 pb-4 px-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Entrada de Estoque</Text>
        </View>
        <TouchableOpacity onPress={() => setCsvModalVisible(true)} className="flex-row items-center bg-white/20 px-3 py-1.5 rounded-full">
          <Ionicons name="document-text-outline" size={16} color="white" />
          <Text className="text-white font-bold text-xs ml-1">CSV</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="flex-row bg-white rounded-full p-1 border border-gray-200 mb-6">
          <TouchableOpacity 
            className={`flex-1 py-3 items-center rounded-full ${tab === 'EXISTENTE' ? 'bg-surface-background' : ''}`}
            onPress={() => setTab('EXISTENTE')}
          >
            <Text className={`font-bold ${tab === 'EXISTENTE' ? 'text-gray-900' : 'text-gray-500'}`}>Touro existente</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-3 items-center rounded-full ${tab === 'NOVO' ? 'bg-surface-background' : ''}`}
            onPress={() => setTab('NOVO')}
          >
            <Text className={`font-bold ${tab === 'NOVO' ? 'text-gray-900' : 'text-gray-500'}`}>Novo touro</Text>
          </TouchableOpacity>
        </View>

        {tab === 'EXISTENTE' && touros.length === 0 ? (
          <View className="bg-white p-6 rounded-full shadow-sm border border-gray-100 items-center mt-2">
            <Text className="text-gray-500 text-lg">Nenhum touro cadastrado ainda.</Text>
          </View>
        ) : (
          <>
            <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
              {tab === 'NOVO' ? (
                <>
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
                    <Text className="text-gray-500 ml-4 flex-1">Toque para usar câmera ou galeria</Text>
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
                </>
              ) : (
                <View>
                   <Text className="text-gray-900 font-bold mb-2">Selecione o Touro</Text>
                   <View className="bg-surface-background rounded-lg border border-gray-200 mb-4 overflow-hidden">
                     <Picker
                       selectedValue={selectedTouroId}
                       onValueChange={(itemValue) => setSelectedTouroId(itemValue)}
                     >
                       {touros.map((t) => (
                         <Picker.Item key={t.id} label={`${t.nome} (${t.raca})`} value={t.id} />
                       ))}
                     </Picker>
                   </View>
                </View>
              )}
            </View>

            {renderLoteCard('CONVENCIONAL', 'Convencional')}
            {renderLoteCard('SEXADO_MACHO', 'Sexado', '♂ (Macho)')}
            {renderLoteCard('SEXADO_FEMEA', 'Sexado', '♀ (Fêmea)')}

            <TouchableOpacity className="w-full bg-primary py-4 rounded-xl items-center mt-2 mb-8" onPress={handleSalvar}>
              <Text className="text-white font-bold text-lg">Salvar Estoque</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <RacaSelectModal 
        visible={racaModalVisible}
        onClose={() => setRacaModalVisible(false)}
        racaSelecionada={raca}
        onSelect={setRaca}
      />
      
      <ImportCsvModal 
        visible={csvModalVisible}
        onClose={() => setCsvModalVisible(false)}
        onImportSuccess={() => {
          carregarTouros();
          setTab('EXISTENTE');
        }}
      />
    </View>
  );
}
