import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, Modal, Share } from 'react-native';
import { db } from '../../src/database';
import { touro, loteSemen, inseminacao } from '../../src/database/schema';
import { useAuthStore } from '../../src/store';
import { Ionicons } from '@expo/vector-icons';
import { isNull } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface ItemCompra {
  id: string;
  touroId: string;
  touroNome: string;
  raca: string;
  codigoRegistro: string | null;
  saldoAtual: number;
  quantidadePedido: number;
  selecionado: boolean;
}

export default function ComprasScreen() {
  const authConta = useAuthStore(state => state.conta);
  const [itensCompra, setItensCompra] = useState<ItemCompra[]>([]);
  const [modalAddVisivel, setModalAddVisivel] = useState(false);

  // Estados para busca e dados do banco de dados no modal
  const [todosTouros, setTodosTouros] = useState<any[]>([]);
  const [todosLotes, setTodosLotes] = useState<any[]>([]);
  const [todosInseminacoes, setTodosInseminacoes] = useState<any[]>([]);
  const [buscaModal, setBuscaModal] = useState('');

  // Estados de edição de texto para o seletor de quantidades
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempText, setTempText] = useState('');

  // Carregar os dados de touros e lotes para o modal e para atualizar a lista
  const carregarDadosDoBanco = async () => {
    try {
      const t = await db.select().from(touro).where(isNull(touro.deletedAt));
      const l = await db.select().from(loteSemen).where(isNull(loteSemen.deletedAt));
      const ins = await db.select().from(inseminacao).where(isNull(inseminacao.deletedAt));

      setTodosTouros(t);
      setTodosLotes(l);
      setTodosInseminacoes(ins);

      // Carregar a lista salva no AsyncStorage
      const saved = await AsyncStorage.getItem('shopping_list');
      if (saved) {
        const parsed = JSON.parse(saved) as ItemCompra[];
        
        // Atualizar o saldoAtual em tempo real de cada item com base no banco local
        const updated = parsed.map(item => {
          const lotesDoTouro = l.filter(lx => lx.touroId === item.touroId);
          const totalEstoque = lotesDoTouro.reduce((acc, lx) => acc + lx.quantidade, 0);
          const insPendentes = ins.filter(i => i.touroId === item.touroId && i.isDirty).length;
          const saldo = totalEstoque - insPendentes;
          return {
            ...item,
            saldoAtual: saldo
          };
        });
        setItensCompra(updated);
      } else {
        setItensCompra([]);
      }
    } catch (e) {
      console.error('Erro ao carregar dados da lista de compras:', e);
    }
  };

  useEffect(() => {
    carregarDadosDoBanco();
  }, []);

  const getSaldoTouro = (tId: string) => {
    const lotesDoTouro = todosLotes.filter(l => l.touroId === tId);
    const totalEstoque = lotesDoTouro.reduce((acc, l) => acc + l.quantidade, 0);
    const insPendentes = todosInseminacoes.filter(i => i.touroId === tId && i.isDirty).length;
    return totalEstoque - insPendentes;
  };

  const adicionarTouroALista = (touroSelecionado: any) => {
    const jaExiste = itensCompra.some(i => i.touroId === touroSelecionado.id);
    if (jaExiste) {
      Alert.alert('Aviso', 'Este touro já está na lista de compras.');
      return;
    }

    const saldo = getSaldoTouro(touroSelecionado.id);
    const novoItem: ItemCompra = {
      id: touroSelecionado.id,
      touroId: touroSelecionado.id,
      touroNome: touroSelecionado.nome,
      raca: touroSelecionado.raca,
      codigoRegistro: touroSelecionado.codigoRegistro,
      saldoAtual: saldo,
      quantidadePedido: 10,
      selecionado: true
    };

    setItensCompra(prev => [...prev, novoItem]);
    setModalAddVisivel(false);
    setBuscaModal('');
  };

  const removerItem = (id: string) => {
    setItensCompra(prev => prev.filter(item => item.id !== id));
  };

  const toggleSelecionado = (id: string) => {
    setItensCompra(prev => prev.map(item => 
      item.id === id ? { ...item, selecionado: !item.selecionado } : item
    ));
  };

  const alterarQuantidade = (id: string, delta: number) => {
    setItensCompra(prev => prev.map(item => {
      if (item.id === id) {
        const novo = item.quantidadePedido + delta;
        return { ...item, quantidadePedido: novo > 0 ? novo : 0 };
      }
      return item;
    }));
  };

  const startEditing = (id: string, qtd: number) => {
    setEditingId(id);
    setTempText(qtd.toString());
  };

  const finishEditing = (id: string) => {
    const val = parseInt(tempText);
    const finalVal = isNaN(val) || val < 0 ? 0 : val;
    setItensCompra(prev => prev.map(item => 
      item.id === id ? { ...item, quantidadePedido: finalVal } : item
    ));
    setEditingId(null);
  };

  const totalItens = itensCompra.length;
  const selecionadosCount = itensCompra.filter(i => i.selecionado).length;
  const todosSelecionados = totalItens > 0 && selecionadosCount === totalItens;

  const toggleMarcarTodos = () => {
    setItensCompra(prev => prev.map(item => ({
      ...item,
      selecionado: !todosSelecionados
    })));
  };

  const salvarListaLocal = async () => {
    try {
      await AsyncStorage.setItem('shopping_list', JSON.stringify(itensCompra));
      Alert.alert('Sucesso', 'Lista de compras salva com sucesso!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar a lista de compras.');
    }
  };

  const compartilharPedido = async () => {
    const selecionados = itensCompra.filter(i => i.selecionado && i.quantidadePedido > 0);
    if (selecionados.length === 0) {
      Alert.alert('Aviso', 'Nenhum item selecionado para compartilhar.');
      return;
    }

    let msg = `*Pedido de Sêmen - AgroSêmen*\n\n`;
    selecionados.forEach(i => {
      msg += `- Touro: ${i.touroNome} (${i.raca || 'Sem raça'})\n  Doses: ${i.quantidadePedido} doses\n`;
    });

    try {
      await Share.share({
        message: msg,
        title: 'Pedido de Sêmen',
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o pedido.');
    }
  };

  const baixarCSV = async () => {
    const selecionados = itensCompra.filter(i => i.selecionado && i.quantidadePedido > 0);
    if (selecionados.length === 0) {
      Alert.alert('Aviso', 'Nenhum item selecionado para exportar.');
      return;
    }

    let csv = 'Touro;Raça;Registro;Quantidade Pedido\n';
    selecionados.forEach(i => {
      csv += `"${i.touroNome}";"${i.raca || ''}";"${i.codigoRegistro || ''}";${i.quantidadePedido}\n`;
    });

    const filename = 'pedido_semen.csv';
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Salvar/Enviar Pedido CSV',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Erro', 'Compartilhamento de arquivos não está disponível neste dispositivo.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Ocorreu um erro ao gerar o arquivo CSV.');
    }
  };

  const tourosFiltradosModal = todosTouros.filter(t => 
    t.nome.toLowerCase().includes(buscaModal.toLowerCase()) || 
    (t.raca && t.raca.toLowerCase().includes(buscaModal.toLowerCase())) ||
    (t.codigoRegistro && t.codigoRegistro.toLowerCase().includes(buscaModal.toLowerCase()))
  );

  return (
    <View className="flex-1 bg-surface-background p-6">
      
      <FlatList
        data={itensCompra}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="mb-4">
            <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4">
              <Text className="text-primary-dark text-center text-sm font-semibold">
                Touros com estoque ≤ {authConta?.estoqueMinAlerta || 5}. Quantidades em pacotes de 10 doses.
              </Text>
            </View>

            <TouchableOpacity 
              onPress={() => {
                carregarDadosDoBanco();
                setModalAddVisivel(true);
              }}
              className="w-full bg-white border border-gray-200 h-16 rounded-2xl items-center justify-center flex-row mb-4 shadow-sm"
            >
              <Ionicons name="add" size={24} color="#1B5E20" />
              <Text className="text-primary-dark font-bold text-lg ml-2">Adicionar Touro à Lista</Text>
            </TouchableOpacity>

            {totalItens > 0 && (
              <View className="flex-row justify-between items-center px-1 mt-2">
                <Text className="text-gray-500 text-sm font-medium">
                  {selecionadosCount} de {totalItens} selecionados
                </Text>
                <TouchableOpacity onPress={toggleMarcarTodos}>
                  <Text className="text-primary font-bold text-sm">
                    {todosSelecionados ? 'Desmarcar todos' : 'Marcar todos'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 items-center justify-center mt-2">
            <Text className="text-gray-500 text-center text-base leading-relaxed">
              Nenhum touro na lista. Use "Adicionar Touro à Lista" para incluir manualmente, ou aguarde até algum estoque ficar baixo.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white p-6 rounded-2xl mb-4 shadow-sm border border-gray-100">
            {/* Top Row: Checkbox, Name, Info, Delete */}
            <View className="flex-row justify-between items-start mb-3">
              <View className="flex-row items-center flex-1 mr-2">
                <TouchableOpacity 
                  className={`w-8 h-8 rounded-full border mr-3 items-center justify-center ${item.selecionado ? 'bg-primary border-primary' : 'border-gray-300'}`}
                  onPress={() => toggleSelecionado(item.id)}
                >
                  {item.selecionado && <Ionicons name="checkmark" size={18} color="white" />}
                </TouchableOpacity>
                
                <View className="flex-1">
                  <Text className="font-bold text-lg text-gray-900">{item.touroNome}</Text>
                  <Text className="text-gray-500 text-sm">{item.raca} · {item.codigoRegistro || '0000'}</Text>
                  <Text className="text-danger font-bold text-sm mt-1">Saldo Atual: {item.saldoAtual} doses</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => removerItem(item.id)} className="p-1">
                <Ionicons name="trash-outline" size={24} color="#D32F2F" />
              </TouchableOpacity>
            </View>

            {/* Divider Line */}
            <View className="h-[1px] bg-gray-100 my-2" />

            {/* Bottom Row: Pedir label + Stepper */}
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-gray-900 font-semibold text-base">
                Pedir: <Text className="text-primary font-bold">{item.quantidadePedido} doses</Text>
              </Text>
              
              <View className="flex-row items-center">
                <TouchableOpacity 
                  className="w-10 h-10 rounded-full border border-gray-300 items-center justify-center bg-white shadow-sm" 
                  onPress={() => alterarQuantidade(item.id, -10)}
                >
                  <Text className="text-xl font-bold text-gray-600">-</Text>
                </TouchableOpacity>

                {editingId === item.id ? (
                  <View className="w-16 h-10 rounded-xl border border-primary bg-white items-center justify-center mx-2 shadow-sm">
                    <TextInput
                      className="font-bold text-lg text-center text-primary-dark w-full h-full"
                      keyboardType="numeric"
                      autoFocus
                      value={tempText}
                      onChangeText={setTempText}
                      onBlur={() => finishEditing(item.id)}
                      onSubmitEditing={() => finishEditing(item.id)}
                    />
                  </View>
                ) : (
                  <TouchableOpacity 
                    className="w-16 h-10 rounded-xl border border-gray-300 bg-white items-center justify-center mx-2 shadow-sm"
                    onPress={() => startEditing(item.id, item.quantidadePedido)}
                  >
                    <Text className="font-bold text-lg text-primary-dark">{item.quantidadePedido}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  className="w-10 h-10 rounded-full border border-gray-300 items-center justify-center bg-white shadow-sm" 
                  onPress={() => alterarQuantidade(item.id, 10)}
                >
                  <Text className="text-xl font-bold text-gray-600">+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          totalItens > 0 ? (
            <View className="mt-4 mb-8">
              <TouchableOpacity 
                className="w-full bg-primary/10 h-16 rounded-2xl items-center justify-center flex-row mb-3 border border-primary/20"
                onPress={salvarListaLocal}
              >
                <Ionicons name="save-outline" size={24} color="#1B5E20" />
                <Text className="text-primary font-bold text-lg ml-2">Salvar Lista</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="w-full bg-primary h-16 rounded-2xl items-center justify-center flex-row mb-4 shadow-sm"
                onPress={compartilharPedido}
              >
                <Ionicons name="share-social-outline" size={24} color="white" />
                <Text className="text-white font-bold text-lg ml-2">Compartilhar Pedido</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="flex-row items-center justify-center py-3 mb-6"
                onPress={baixarCSV}
              >
                <Ionicons name="download-outline" size={20} color="#4B5563" />
                <Text className="text-gray-600 font-bold text-base ml-2">Baixar CSV</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Modal para adicionar touro */}
      <Modal visible={modalAddVisivel} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface-background rounded-t-3xl h-[85%] p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-primary-dark">Adicionar Touro</Text>
              <TouchableOpacity onPress={() => setModalAddVisivel(false)} className="p-2 border border-gray-300 rounded-full">
                <Ionicons name="close" size={20} color="#1B5E20" />
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row items-center">
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                placeholder="Buscar por nome, raça ou registro..."
                value={buscaModal}
                onChangeText={setBuscaModal}
                className="flex-1 text-base text-gray-900 ml-2"
              />
            </View>

            <FlatList
              data={tourosFiltradosModal}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const saldo = getSaldoTouro(item.id);
                return (
                  <TouchableOpacity 
                    className="bg-white p-5 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row justify-between items-center"
                    onPress={() => adicionarTouroALista(item)}
                  >
                    <View className="flex-1 mr-2">
                      <Text className="font-bold text-lg text-gray-900">{item.nome}</Text>
                      <Text className="text-gray-500 text-sm">{item.raca} · {item.codigoRegistro || '0000'}</Text>
                    </View>
                    <View className="bg-primary/10 px-3 py-1.5 rounded-xl">
                      <Text className="text-primary font-bold text-sm">Saldo: {saldo}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View className="py-10 items-center justify-center">
                  <Text className="text-gray-500 text-base">Nenhum touro encontrado.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

    </View>
  );
}
