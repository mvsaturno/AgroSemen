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
  const [clienteNaoCadastrado, setClienteNaoCadastrado] = useState('');
  const [identificacaoVaca, setIdentificacaoVaca] = useState('');
  const [valorCobrado, setValorCobrado] = useState('');
  const [dataInseminacao, setDataInseminacao] = useState('');
  
  const [touros, setTouros] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [selectedTouroId, setSelectedTouroId] = useState('');
  const [selectedLoteId, setSelectedLoteId] = useState('');
  
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

      const tList = await db.select().from(touro).where(isNull(touro.deletedAt));
      const lList = await db.select().from(loteSemen).where(isNull(loteSemen.deletedAt));
      setTouros(tList);
      setLotes(lList);

      const ins = await db.select().from(inseminacao).where(eq(inseminacao.id, inseminacaoId)).limit(1);
      if (ins.length > 0) {
        const item = ins[0];
        setSelectedCliente(item.clienteId || '');
        setClienteNaoCadastrado(item.nota || ''); // Guardamos o nome não cadastrado na nota
        setIdentificacaoVaca(item.identificacaoVaca || '');
        setValorCobrado(item.valorCobrado ? String(item.valorCobrado) : '0');
        setDataInseminacao(parseDateToLocale(item.dataInseminacao));
        setLoteIdOriginal(item.loteSemenId);
        
        setSelectedTouroId(item.touroId);
        setSelectedLoteId(item.loteSemenId);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar o registro.');
    }
  };

  const handleSalvar = async () => {
    if (!selectedLoteId) {
      return Alert.alert('Erro', 'Selecione um lote de sêmen válido.');
    }

    try {
      const timestamp = new Date().toISOString();
      
      // Se trocou o lote, precisamos devolver a dose para o original e tirar do novo
      if (selectedLoteId !== loteIdOriginal) {
        // Devolve pro antigo
        const loteAntigo = await db.select().from(loteSemen).where(eq(loteSemen.id, loteIdOriginal)).limit(1);
        if (loteAntigo.length > 0) {
          await db.update(loteSemen)
            .set({ quantidade: loteAntigo[0].quantidade + 1, updatedAt: timestamp, isDirty: true })
            .where(eq(loteSemen.id, loteIdOriginal));
        }

        // Tira do novo
        const loteNovo = await db.select().from(loteSemen).where(eq(loteSemen.id, selectedLoteId)).limit(1);
        if (loteNovo.length > 0) {
          if (loteNovo[0].quantidade <= 0) {
            return Alert.alert('Aviso', 'O lote selecionado não tem saldo suficiente.');
          }
          await db.update(loteSemen)
            .set({ quantidade: loteNovo[0].quantidade - 1, updatedAt: timestamp, isDirty: true })
            .where(eq(loteSemen.id, selectedLoteId));
        }
      }

      await db.update(inseminacao).set({
        touroId: selectedTouroId,
        loteSemenId: selectedLoteId,
        clienteId: selectedCliente || null,
        nota: selectedCliente ? null : clienteNaoCadastrado, // salva a nota se não tiver cliente
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

  const formatTipoLote = (tipo: string) => {
    if (tipo === 'CONVENCIONAL') return 'Convencional';
    if (tipo === 'SEXADO_MACHO') return 'Sexado ♂ (Macho)';
    if (tipo === 'SEXADO_FEMEA') return 'Sexado ♀ (Fêmea)';
    return tipo;
  };

  const lotesDisponiveis = lotes.filter(l => l.touroId === selectedTouroId);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-surface-background rounded-t-3xl h-[85%] p-6">
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 mr-4">
              <Text className="text-2xl font-bold text-primary-dark">Editar inseminação</Text>
              <Text className="text-gray-500 text-sm mt-1 leading-tight">
                Ajuste os dados do registro. Trocar touro ou tipo de sêmen reequilibra o estoque.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={24} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            
            {/* Touro */}
            <Text className="text-gray-900 font-bold mb-1 ml-1">Touro</Text>
            <View className="bg-surface-background rounded-xl border border-gray-300 mb-4 overflow-hidden">
              <Picker
                selectedValue={selectedTouroId}
                onValueChange={(itemValue) => {
                  setSelectedTouroId(itemValue);
                  const firstLote = lotes.find(l => l.touroId === itemValue);
                  setSelectedLoteId(firstLote ? firstLote.id : '');
                }}
              >
                {touros.map((t) => {
                  const tLotes = lotes.filter(l => l.touroId === t.id);
                  let stockStr = '';
                  tLotes.forEach(l => {
                    const prefix = l.tipo === 'CONVENCIONAL' ? 'C' : l.tipo === 'SEXADO_MACHO' ? '♂' : '♀';
                    stockStr += `${prefix} ${l.quantidade} / `;
                  });
                  stockStr = stockStr.slice(0, -3);
                  return <Picker.Item key={t.id} label={`${t.nome} · ${stockStr}`} value={t.id} />;
                })}
              </Picker>
            </View>

            {/* Tipo de Sêmen */}
            <Text className="text-gray-900 font-bold mb-1 ml-1">Tipo de sêmen</Text>
            <View className="bg-surface-background rounded-xl border border-gray-200 mb-4 overflow-hidden">
              <Picker
                selectedValue={selectedLoteId}
                onValueChange={(itemValue) => setSelectedLoteId(itemValue)}
                enabled={lotesDisponiveis.length > 0}
              >
                {lotesDisponiveis.map((l) => (
                  <Picker.Item key={l.id} label={`${formatTipoLote(l.tipo)}`} value={l.id} />
                ))}
                {lotesDisponiveis.length === 0 && (
                  <Picker.Item label="Nenhum lote disponível" value="" />
                )}
              </Picker>
            </View>

            {/* Vaca */}
            <Text className="text-gray-900 font-bold mb-1 ml-1">Vaca (brinco/nº)</Text>
            <TextInput 
              className="bg-surface-background p-3.5 rounded-xl border border-gray-200 mb-4 text-gray-900" 
              value={identificacaoVaca} 
              onChangeText={setIdentificacaoVaca} 
            />

            {/* Cliente */}
            <Text className="text-gray-900 font-bold mb-1 ml-1">Cliente</Text>
            <View className="bg-surface-background rounded-xl border border-gray-200 mb-2 overflow-hidden">
              <Picker
                selectedValue={selectedCliente}
                onValueChange={(itemValue) => setSelectedCliente(itemValue)}
              >
                <Picker.Item label="— Sem cliente cadastrado (Cliente sem identificação) —" value="" color="#6B7280" />
                {clientes.map((c) => (
                  <Picker.Item key={c.id} label={c.nome} value={c.id} />
                ))}
              </Picker>
            </View>
            
            {/* Input para cliente não cadastrado */}
            {!selectedCliente && (
              <TextInput 
                className="bg-surface-background p-3.5 rounded-xl border border-gray-200 mb-4 text-gray-900" 
                placeholder="Nome do cliente não cadastrado..."
                value={clienteNaoCadastrado} 
                onChangeText={setClienteNaoCadastrado} 
              />
            )}
            
            <View className={`flex-row gap-4 mb-4 ${selectedCliente ? '' : 'mt-0'}`}>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold mb-1 ml-1">Data</Text>
                <View className="flex-row items-center bg-surface-background border border-gray-200 rounded-xl px-3.5">
                  <TextInput 
                    className="flex-1 py-3.5 text-gray-900" 
                    placeholder="DD/MM/AAAA"
                    value={dataInseminacao} 
                    onChangeText={setDataInseminacao} 
                  />
                  <Ionicons name="calendar-outline" size={20} color="#4B5563" />
                </View>
              </View>

              <View className="flex-1">
                <Text className="text-gray-900 font-bold mb-1 ml-1">Valor (R$)</Text>
                <TextInput 
                  className="bg-surface-background py-3.5 px-3.5 rounded-xl border border-gray-200 text-gray-900" 
                  keyboardType="numeric"
                  value={valorCobrado} 
                  onChangeText={setValorCobrado} 
                  editable={isPrestador}
                  style={!isPrestador ? { opacity: 0.5 } : {}}
                />
              </View>
            </View>

            {/* Ações */}
            <View className="flex-row justify-between items-center mt-4">
              <TouchableOpacity onPress={handleExcluir} className="p-3">
                <Text className="text-gray-400 underline">Excluir Registro</Text>
              </TouchableOpacity>
              <View className="flex-row gap-3">
                <TouchableOpacity 
                  className="bg-white border border-gray-300 py-3 px-6 rounded-full items-center justify-center" 
                  onPress={onClose}
                >
                  <Text className="text-gray-900 font-bold text-base">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-primary-dark py-3 px-8 rounded-full items-center justify-center" 
                  onPress={handleSalvar}
                >
                  <Text className="text-white font-bold text-base">Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
