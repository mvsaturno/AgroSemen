import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { db } from '../../src/database';
import { cliente, inseminacao } from '../../src/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store';
import { v4 as uuidv4 } from 'uuid';
import { Ionicons } from '@expo/vector-icons';

export default function ClientesScreen() {
  const router = useRouter();
  const authConta = useAuthStore(state => state.conta);

  const [clientes, setClientes] = useState<any[]>([]);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [fazenda, setFazenda] = useState('');

  useFocusEffect(
    useCallback(() => {
      carregarClientes();
    }, [])
  );

  const carregarClientes = async () => {
    if (!authConta) return;
    const data = await db.select().from(cliente).where(and(eq(cliente.contaId, authConta.id), isNull(cliente.deletedAt)));
    const insData = await db.select().from(inseminacao).where(and(eq(inseminacao.contaId, authConta.id), isNull(inseminacao.deletedAt)));
    
    const cWithStats = data.map(c => {
      const cIns = insData.filter(i => i.clienteId === c.id);
      const aplicacoes = cIns.length;
      const valorTotal = cIns.reduce((acc, curr) => acc + (curr.valorCobrado || 0), 0);
      return { ...c, aplicacoes, valorTotal };
    });
    setClientes(cWithStats);
  };

  const handleSalvar = async () => {
    if (!authConta) return;
    if (!nome) {
      Alert.alert('Erro', 'O nome do cliente é obrigatório.');
      return;
    }

    try {
      if (editingClienteId) {
        await db.update(cliente).set({
          nome,
          telefone,
          fazenda,
          updatedAt: new Date().toISOString(),
          isDirty: true,
        }).where(eq(cliente.id, editingClienteId));
        Alert.alert('Sucesso', 'Cliente atualizado com sucesso!');
      } else {
        await db.insert(cliente).values({
          id: uuidv4(),
          contaId: authConta.id,
          nome,
          telefone,
          fazenda,
          updatedAt: new Date().toISOString(),
          isDirty: true,
        });
        Alert.alert('Sucesso', 'Cliente cadastrado com sucesso!');
      }
      fecharModal();
      carregarClientes();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o cliente.');
    }
  };

  const handleEdit = (c: any) => {
    setEditingClienteId(c.id);
    setNome(c.nome);
    setTelefone(c.telefone || '');
    setFazenda(c.fazenda || '');
    setModalVisivel(true);
  };

  const handleDelete = (c: any) => {
    Alert.alert('Remover Cliente', `Deseja realmente remover ${c.nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Remover', 
        style: 'destructive', 
        onPress: async () => {
          await db.update(cliente).set({
            deletedAt: new Date().toISOString(),
            isDirty: true,
          }).where(eq(cliente.id, c.id));
          carregarClientes();
        }
      }
    ]);
  };

  const fecharModal = () => {
    setModalVisivel(false);
    setEditingClienteId('');
    setNome('');
    setTelefone('');
    setFazenda('');
  };

  return (
    <View className="flex-1 bg-surface-background">
      <View className="bg-primary pt-12 pb-4 px-4 flex-row items-center justify-between shadow-sm">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Clientes</Text>
        </View>
      </View>

      <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 100 }}>
        <TouchableOpacity 
          className="w-full bg-primary py-4 rounded-2xl items-center flex-row justify-center mb-6 shadow-sm"
          onPress={() => setModalVisivel(true)}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text className="text-white font-bold text-lg ml-2">Novo cliente</Text>
        </TouchableOpacity>

        {clientes.length === 0 ? (
          <Text className="text-gray-500 text-center mt-4">Nenhum cliente cadastrado.</Text>
        ) : (
          clientes.map(c => (
            <View key={c.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 flex-row justify-between items-center">
              <View className="flex-1 mr-4">
                <Text className="font-bold text-gray-900 text-xl mb-1">{c.nome}</Text>
                {c.telefone ? (
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="call-outline" size={14} color="#6B7280" />
                    <Text className="text-gray-500 text-sm ml-1">{c.telefone}</Text>
                  </View>
                ) : null}
                {c.fazenda ? (
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="location-outline" size={14} color="#6B7280" />
                    <Text className="text-gray-500 text-sm ml-1">{c.fazenda}</Text>
                  </View>
                ) : null}
                
                <Text className="text-gray-700 text-sm mt-1">
                  {c.aplicacoes} {c.aplicacoes === 1 ? 'aplicação' : 'aplicações'} · <Text className="font-bold text-gray-900">R$ {c.valorTotal.toFixed(2).replace('.', ',')}</Text>
                </Text>
              </View>

              <View className="flex-row items-center">
                <TouchableOpacity 
                  className="w-10 h-10 rounded-full border border-gray-200 items-center justify-center mr-2 bg-surface-background"
                  onPress={() => handleEdit(c)}
                >
                  <Ionicons name="pencil-outline" size={18} color="#374151" />
                </TouchableOpacity>
                <TouchableOpacity 
                  className="w-10 h-10 rounded-full border border-danger/30 items-center justify-center bg-danger/5"
                  onPress={() => handleDelete(c)}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisivel} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center bg-black/50 p-4">
          <View className="bg-surface-background rounded-2xl p-6 shadow-lg">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">{editingClienteId ? 'Editar cliente' : 'Novo cliente'}</Text>
              <TouchableOpacity onPress={fecharModal}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>
            
            <Text className="text-gray-900 font-bold mb-2">Nome *</Text>
            <TextInput 
              className="bg-white p-3 rounded-xl border border-gray-200 mb-4 text-gray-900" 
              value={nome}
              onChangeText={setNome}
            />

            <Text className="text-gray-900 font-bold mb-2">Telefone / WhatsApp</Text>
            <TextInput 
              className="bg-white p-3 rounded-xl border border-gray-200 mb-4 text-gray-900" 
              keyboardType="phone-pad"
              value={telefone}
              onChangeText={setTelefone}
            />

            <Text className="text-gray-900 font-bold mb-2">Propriedade / Localização</Text>
            <TextInput 
              className="bg-white p-3 rounded-xl border border-gray-200 mb-8 text-gray-900" 
              value={fazenda}
              onChangeText={setFazenda}
            />

            <TouchableOpacity 
              className="w-full bg-primary py-4 rounded-xl items-center mt-2" 
              onPress={handleSalvar}
            >
              <Text className="text-white font-bold text-lg">{editingClienteId ? 'Salvar Alterações' : 'Registrar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
