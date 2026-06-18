import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { db } from '../src/database';
import { touro, loteSemen } from '../src/database/schema';
import { useAuthStore } from '../src/store';
import { v4 as uuidv4 } from 'uuid';
import { parseCSV, ParsedTouroCSV } from '../src/utils/csvParser';

interface ImportCsvModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function ImportCsvModal({ visible, onClose, onImportSuccess }: ImportCsvModalProps) {
  const authConta = useAuthStore((state: any) => state.conta);
  const isPrestador = authConta?.perfil === 'PRESTADOR';

  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTouroCSV[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setFileName(file.name);
      
      const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      
      const parsed = parseCSV(fileContent);
      if (parsed.length === 0) {
        Alert.alert('Aviso', 'Nenhum dado válido encontrado no CSV.');
        setParsedData([]);
      } else {
        setParsedData(parsed);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Erro', e.message || 'Falha ao processar o arquivo CSV.');
      setParsedData([]);
    }
  };

  const handleConfirm = async () => {
    if (parsedData.length === 0 || !authConta) return;
    
    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();

      for (const item of parsedData) {
        const touroId = uuidv4();

        // Insere Touro
        await db.insert(touro).values({
          id: touroId,
          contaId: authConta.id,
          nome: item.nome,
          raca: item.raca,
          empresaFornecedora: item.empresaFornecedora,
          isDirty: true,
          updatedAt: timestamp,
        });

        const insertLote = async (tipo: string, qtd: number, valorUnitario: number) => {
          if (qtd > 0) {
            await db.insert(loteSemen).values({
              id: uuidv4(),
              contaId: authConta.id,
              touroId,
              tipo,
              quantidade: qtd,
              valorUnitario: isPrestador ? valorUnitario : 0, // Simplified value logic for bulk
              isDirty: true,
              updatedAt: timestamp,
            });
          }
        };

        await insertLote('CONVENCIONAL', item.qtdConvencional, authConta.valorPadraoCon || 0);
        await insertLote('SEXADO_MACHO', item.qtdSexadoMacho, authConta.valorPadraoSex || 0);
        await insertLote('SEXADO_FEMEA', item.qtdSexadoFemea, authConta.valorPadraoSex || 0);
      }

      Alert.alert('Sucesso', `${parsedData.length} touros importados com sucesso!`);
      setParsedData([]);
      setFileName(null);
      onImportSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar os dados no banco local.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setParsedData([]);
    setFileName(null);
    onClose();
  };

  const totalDoses = parsedData.reduce((acc, t) => acc + t.qtdConvencional + t.qtdSexadoMacho + t.qtdSexadoFemea, 0);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-surface-background rounded-t-3xl h-[85%] p-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-primary-dark">Importar Estoque (CSV)</Text>
            <TouchableOpacity onPress={closeModal} className="p-2 border border-gray-300 rounded-full">
              <Ionicons name="close" size={20} color="#1B5E20" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            
            <View className="bg-primary/10 p-4 rounded-xl border border-primary/20 mb-6">
              <Text className="text-primary-dark font-bold mb-2">Formato Esperado</Text>
              <Text className="text-gray-700 text-sm mb-2">
                O arquivo deve ter colunas separadas por vírgula (,) ou ponto e vírgula (;). 
                Apenas a coluna "Nome" é obrigatória.
              </Text>
              <Text className="text-gray-600 text-xs italic">
                Exemplo: Nome, Raça, Central, Convencional, Macho, Fêmea
              </Text>
            </View>

            <TouchableOpacity 
              className="bg-white border-2 border-dashed border-primary/50 rounded-2xl p-8 items-center justify-center mb-6"
              onPress={handleSelectFile}
            >
              <Ionicons name="document-text-outline" size={48} color="#1B5E20" />
              <Text className="text-primary-dark font-bold text-lg mt-4 text-center">
                {fileName ? fileName : 'Tocar para Selecionar Arquivo'}
              </Text>
              {!fileName && <Text className="text-gray-500 text-sm mt-1">Formatos suportados: .csv</Text>}
            </TouchableOpacity>

            {parsedData.length > 0 && (
              <View className="mb-6">
                <Text className="font-bold text-lg text-gray-900 mb-4">Resumo da Importação</Text>
                <View className="flex-row mb-4">
                  <View className="flex-1 bg-white p-4 rounded-xl border border-gray-100 mr-2 items-center">
                    <Text className="text-gray-500 text-xs font-bold uppercase mb-1">Touros Novos</Text>
                    <Text className="text-2xl font-bold text-primary">{parsedData.length}</Text>
                  </View>
                  <View className="flex-1 bg-white p-4 rounded-xl border border-gray-100 ml-2 items-center">
                    <Text className="text-gray-500 text-xs font-bold uppercase mb-1">Total de Doses</Text>
                    <Text className="text-2xl font-bold text-gray-900">{totalDoses}</Text>
                  </View>
                </View>

                <View className="bg-white rounded-xl border border-gray-100 p-2 max-h-64">
                  <ScrollView nestedScrollEnabled>
                    {parsedData.map((t, idx) => {
                       const soma = t.qtdConvencional + t.qtdSexadoFemea + t.qtdSexadoMacho;
                       return (
                         <View key={idx} className="flex-row justify-between items-center py-2 px-3 border-b border-gray-50">
                           <View>
                             <Text className="font-bold text-gray-900">{t.nome}</Text>
                             <Text className="text-xs text-gray-500">{t.raca || 'Sem raça'}</Text>
                           </View>
                           <Text className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{soma} doses</Text>
                         </View>
                       )
                    })}
                  </ScrollView>
                </View>
              </View>
            )}

            <TouchableOpacity 
              className={`w-full h-16 rounded-2xl items-center justify-center flex-row ${parsedData.length === 0 ? 'bg-gray-300' : 'bg-primary'}`}
              onPress={handleConfirm}
              disabled={parsedData.length === 0 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color={parsedData.length === 0 ? '#9CA3AF' : 'white'} />
                  <Text className={`font-bold text-xl ml-2 ${parsedData.length === 0 ? 'text-gray-500' : 'text-white'}`}>
                    Confirmar Importação
                  </Text>
                </>
              )}
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
