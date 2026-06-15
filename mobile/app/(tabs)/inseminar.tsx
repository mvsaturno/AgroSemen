import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { db } from '../../src/database';
import { touro, loteSemen, cliente, inseminacao } from '../../src/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAuthStore } from '../../src/store';
import { v4 as uuidv4 } from 'uuid';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

export default function InseminarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const authUser = useAuthStore(state => state.user);
  const authConta = useAuthStore(state => state.conta);

  const [touros, setTouros] = useState<any[]>([]);
  const [todosLotes, setTodosLotes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);

  const [selectedTouro, setSelectedTouro] = useState(params.touroId as string || '');
  const [selectedLote, setSelectedLote] = useState('');
  const [selectedCliente, setSelectedCliente] = useState('');
  const [identificacaoVaca, setIdentificacaoVaca] = useState('');
  const [valorCobrado, setValorCobrado] = useState('');
  const [dataInseminacao, setDataInseminacao] = useState(new Date().toLocaleDateString('pt-BR'));
  
  const parseDateToISO = (dateStr: string): string => {
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

  // Novo Cliente Modal
  const [modalClienteVisivel, setModalClienteVisivel] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [novoClienteFazenda, setNovoClienteFazenda] = useState('');

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [])
  );

  const lotesVisiveis = todosLotes.filter(l => l.touroId === selectedTouro && l.quantidade > 0);

  const carregarDados = async () => {
    const t = await db.select().from(touro).where(isNull(touro.deletedAt));
    const l = await db.select().from(loteSemen).where(isNull(loteSemen.deletedAt));
    const c = await db.select().from(cliente).where(isNull(cliente.deletedAt));
    setTouros(t);
    setTodosLotes(l);
    setClientes(c);
  };

  const getSaldosTouro = (tId: string) => {
    let con = 0; let m = 0; let f = 0;
    todosLotes.forEach(l => {
      if (l.touroId === tId) {
        if (l.tipo === 'CONVENCIONAL') con += l.quantidade;
        if (l.tipo === 'SEXADO_MACHO') m += l.quantidade;
        if (l.tipo === 'SEXADO_FEMEA') f += l.quantidade;
      }
    });
    return `C ${con} / ♂ ${m} / ♀ ${f}`;
  };

  const getLabelTipo = (tipo: string) => {
    if (tipo === 'CONVENCIONAL') return 'Convencional';
    if (tipo === 'SEXADO_MACHO') return 'Sexado ♂ (Macho)';
    if (tipo === 'SEXADO_FEMEA') return 'Sexado ♀ (Fêmea)';
    return tipo;
  };

  const handleSalvar = async () => {
    if (!authUser || !authConta) return;
    if (!selectedTouro || !selectedLote) {
      Alert.alert('Erro', 'Selecione um touro e um tipo de sêmen válido.');
      return;
    }

    try {
      const isoDate = parseDateToISO(dataInseminacao);

      await db.insert(inseminacao).values({
        id: uuidv4(),
        contaId: authConta.id,
        touroId: selectedTouro,
        loteSemenId: selectedLote,
        usuarioId: authUser.id,
        clienteId: selectedCliente || null,
        identificacaoVaca,
        valorCobrado: Number(valorCobrado) || 0,
        dataInseminacao: isoDate, // Salva em ISO no SQLite
        isDirty: true, // Crucial: marca para ser sincronizado no push
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Decrementar lote localmente
      const lotesEncontrados = await db.select().from(loteSemen).where(eq(loteSemen.id, selectedLote)).limit(1);
      if (lotesEncontrados.length > 0) {
        const novaQtd = lotesEncontrados[0].quantidade - 1;
        await db.update(loteSemen)
          .set({
            quantidade: novaQtd >= 0 ? novaQtd : 0,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(loteSemen.id, selectedLote));
      }

      Alert.alert('Sucesso', 'Inseminação registrada com sucesso!');
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível registrar a inseminação.');
    }
  };

  const salvarNovoCliente = async () => {
    if (!authConta) return;
    if (!novoClienteNome) {
      Alert.alert('Erro', 'Nome do cliente é obrigatório');
      return;
    }
    const novoId = uuidv4();
    try {
      await db.insert(cliente).values({
        id: novoId,
        contaId: authConta.id,
        nome: novoClienteNome,
        telefone: novoClienteTelefone,
        fazenda: novoClienteFazenda,
        updatedAt: new Date().toISOString(),
        isDirty: true, // Crucial: marca para ser sincronizado no push
      });
      setModalClienteVisivel(false);
      setNovoClienteNome('');
      setNovoClienteTelefone('');
      setNovoClienteFazenda('');
      await carregarDados();
      setSelectedCliente(novoId);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar cliente');
    }
  };

  return (
    <ScrollView className="flex-1 bg-surface-background p-6">
      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <Text className="text-2xl font-bold text-primary-dark mb-6">Nova Inseminação</Text>
        
        <Text className="text-gray-800 text-base mb-2 font-semibold">Touro utilizado</Text>
        <View className="bg-surface-background rounded-xl border border-gray-200 mb-5 overflow-hidden">
          <Picker
            selectedValue={selectedTouro}
            onValueChange={(itemValue) => setSelectedTouro(itemValue)}
          >
            <Picker.Item label="Selecione um touro..." value="" color="#9CA3AF" />
            {touros.map((t) => (
              <Picker.Item key={t.id} label={`${t.nome} · ${getSaldosTouro(t.id)}`} value={t.id} />
            ))}
          </Picker>
        </View>

        <Text className="text-gray-800 text-base mb-2 font-semibold">Tipo de sêmen</Text>
        <View className="bg-surface-background rounded-xl border border-gray-200 mb-5 overflow-hidden">
          <Picker
            selectedValue={selectedLote}
            onValueChange={(itemValue) => setSelectedLote(itemValue)}
            enabled={!!selectedTouro}
          >
            <Picker.Item label="Selecione um tipo..." value="" color="#9CA3AF" />
            {lotesVisiveis.map((l) => (
              <Picker.Item key={l.id} label={getLabelTipo(l.tipo)} value={l.id} />
            ))}
          </Picker>
        </View>

        <Text className="text-gray-800 text-base mb-2 font-semibold">Cliente / Fazenda</Text>
        <View className="flex-row items-center mb-5">
          <View className="flex-1 bg-surface-background rounded-xl border border-gray-200 overflow-hidden mr-3">
            <Picker
              selectedValue={selectedCliente}
              onValueChange={(itemValue) => setSelectedCliente(itemValue)}
            >
              <Picker.Item label="Selecionar cliente" value="" color="#9CA3AF" />
              {clientes.map((c) => (
                <Picker.Item key={c.id} label={c.nome} value={c.id} />
              ))}
            </Picker>
          </View>
          <TouchableOpacity 
            onPress={() => setModalClienteVisivel(true)}
            className="bg-surface-background border border-gray-200 p-4 rounded-xl"
          >
            <Ionicons name="add" size={24} color="#1B5E20" />
          </TouchableOpacity>
        </View>

        <Text className="text-gray-800 text-base mb-2 font-semibold">Identificação da Vaca</Text>
        <TextInput 
          className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-5 text-base text-gray-900" 
          placeholder="Ex: Mimosa, Brinco 102"
          value={identificacaoVaca}
          onChangeText={setIdentificacaoVaca}
        />

        {(!authConta || authConta.perfil === 'PRESTADOR') && (
          <>
            <Text className="text-gray-800 text-base mb-2 font-semibold">Valor Cobrado (R$)</Text>
            <TextInput 
              className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-5 text-base text-gray-900" 
              keyboardType="numeric"
              placeholder="0.00"
              value={valorCobrado}
              onChangeText={setValorCobrado}
            />
          </>
        )}

        <Text className="text-gray-800 text-base mb-2 font-semibold">Data</Text>
        <TextInput 
          className="bg-surface-background p-4 rounded-xl border border-gray-200 mb-10 text-base text-gray-900" 
          placeholder="DD/MM/AAAA"
          value={dataInseminacao}
          onChangeText={setDataInseminacao}
        />

        <TouchableOpacity 
          className="w-full bg-primary h-16 rounded-2xl items-center justify-center mb-8"
          onPress={handleSalvar}
        >
          <Text className="text-white font-bold text-xl">Registrar</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalClienteVisivel} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center bg-black/50 p-4">
          <View className="bg-surface-background rounded-2xl p-6 shadow-lg">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Novo cliente</Text>
              <TouchableOpacity onPress={() => setModalClienteVisivel(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>
            
            <Text className="text-gray-900 font-bold mb-2">Nome *</Text>
            <TextInput 
              className="bg-white p-3 rounded-xl border border-gray-200 mb-4 text-gray-900" 
              value={novoClienteNome}
              onChangeText={setNovoClienteNome}
            />

            <Text className="text-gray-900 font-bold mb-2">Telefone / WhatsApp</Text>
            <TextInput 
              className="bg-white p-3 rounded-xl border border-gray-200 mb-4 text-gray-900" 
              keyboardType="phone-pad"
              value={novoClienteTelefone}
              onChangeText={setNovoClienteTelefone}
            />

            <Text className="text-gray-900 font-bold mb-2">Propriedade / Localização</Text>
            <TextInput 
              className="bg-white p-3 rounded-xl border border-gray-200 mb-8 text-gray-900" 
              value={novoClienteFazenda}
              onChangeText={setNovoClienteFazenda}
            />

            <TouchableOpacity 
              className="w-full bg-primary py-4 rounded-xl items-center mt-2" 
              onPress={salvarNovoCliente}
            >
              <Text className="text-white font-bold text-lg">Registrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
