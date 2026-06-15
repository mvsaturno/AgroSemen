import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { useAuthStore } from '../../src/store';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function ConfiguracoesScreen() {
  const logout = useAuthStore(state => state.logout);
  const authUser = useAuthStore(state => state.user);
  const authConta = useAuthStore(state => state.conta);
  const router = useRouter();

  const [estoqueMin, setEstoqueMin] = useState(
    authConta?.estoqueMinAlerta?.toString() ?? '5'
  );
  const [whatsapp, setWhatsapp] = useState(authConta?.whatsappCatalogo ?? '');
  const [savingSettings, setSavingSettings] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const gerarConvite = () => {
    const msg = `Você foi convidado para a conta AgroSêmen: ${authConta?.nome}.\nBaixe o App e use o telefone com PIN gerado pelo admin.`;
    Alert.alert('Gerar Convite', 'Aqui geraremos o link mágico/WhatsApp:\n\n' + msg);
  };

  const handleChangePerfil = () => {
    Alert.alert(
      'Perfil do Aplicativo',
      'Como você vai usar o AgroSêmen?',
      [
        {
          text: 'Uso Próprio (Produtor Rural)',
          onPress: () => salvarPerfil('USO_PROPRIO'),
        },
        {
          text: 'Prestador de Serviços',
          onPress: () => salvarPerfil('PRESTADOR'),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const salvarPerfil = async (novoPerfil: 'USO_PROPRIO' | 'PRESTADOR') => {
    if (novoPerfil === authConta?.perfil) return;
    try {
      const { data } = await api.put('/conta/perfil', { perfil: novoPerfil });
      const login = useAuthStore.getState().login;
      await login({
        usuario: authUser!,
        conta: data.conta,
      });
      Alert.alert('Sucesso', 'Perfil atualizado.');
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível alterar o perfil.');
    }
  };

  const salvarConfiguracoes = async () => {
    const estoqueMinNum = parseInt(estoqueMin, 10);
    if (isNaN(estoqueMinNum) || estoqueMinNum < 0) {
      Alert.alert('Erro', 'Estoque mínimo deve ser um número inteiro positivo.');
      return;
    }

    setSavingSettings(true);
    try {
      const { data } = await api.patch('/conta/settings', {
        estoqueMinAlerta: estoqueMinNum,
        whatsappCatalogo: whatsapp.trim() || null,
      });
      const login = useAuthStore.getState().login;
      await login({
        usuario: authUser!,
        conta: data.conta,
      });
      Alert.alert('Sucesso', 'Configurações salvas com sucesso!');
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível salvar as configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const isAdmin = authUser?.papel === 'ADMIN';

  return (
    <ScrollView className="flex-1 bg-surface-background p-6">
      
      <View className="mb-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Ajustes</Text>
        <Text className="text-gray-500 text-base">Configure sua conta e preferências</Text>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <Text className="text-gray-500 text-sm mb-1.5 uppercase font-bold tracking-wider">Usuário</Text>
        <Text className="font-bold text-gray-900 text-xl mb-1">{authUser?.nome}</Text>
        <Text className="text-gray-500 text-base mb-1">{authUser?.telefone}</Text>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <Text className="text-gray-500 text-sm mb-3 uppercase font-bold tracking-wider">Perfil do Aplicativo</Text>
        
        <TouchableOpacity 
          className="flex-row items-center justify-between border border-gray-200 p-4 rounded-xl bg-surface-background mb-3"
          onPress={handleChangePerfil}
          disabled={!isAdmin}
        >
          <View className="flex-row items-center">
            <Text className="text-2xl mr-2">{authConta?.perfil === 'PRESTADOR' ? '💼' : '🚜'}</Text>
            <Text className="font-bold text-gray-800 text-lg">
              {authConta?.perfil === 'PRESTADOR' ? 'Prestador de Serviços' : 'Uso Próprio (Produtor Rural)'}
            </Text>
          </View>
          {isAdmin && <Ionicons name="chevron-down" size={24} color="#9CA3AF" />}
        </TouchableOpacity>

        <Text className="text-gray-500 text-sm leading-relaxed">
          <Text className="font-bold text-gray-700">Uso Próprio:</Text> oculta valores em todo o app (Histórico, faturamento, ranking).{'\n'}
          <Text className="font-bold text-gray-700">Prestador de Serviços:</Text> habilita campo de valor e relatórios financeiros.
        </Text>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <Text className="font-bold text-gray-900 text-lg mb-1">Estoque Mínimo de Alerta (palhetas)</Text>
        <Text className="text-gray-500 text-sm mb-3">
          Touros com saldo ≤ este valor aparecem como alerta e entram na lista de Compras.
        </Text>
        <TextInput 
          className={`bg-surface-background p-4 rounded-xl border text-gray-900 text-base ${isAdmin ? 'border-gray-300' : 'border-gray-200 opacity-60'}`}
          value={estoqueMin}
          onChangeText={setEstoqueMin}
          keyboardType="numeric"
          editable={isAdmin}
          placeholder="Ex: 5"
        />
        {!isAdmin && (
          <Text className="text-gray-400 text-xs mt-1">Apenas o administrador pode alterar.</Text>
        )}
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <Text className="font-bold text-gray-900 text-lg mb-1">WhatsApp para receber pedidos do catálogo</Text>
        <Text className="text-gray-500 text-sm mb-3">
          Formato: DDI + DDD + número (ex: 5511999999999)
        </Text>
        <TextInput 
          className={`bg-surface-background p-4 rounded-xl border text-gray-900 text-base ${isAdmin ? 'border-gray-300' : 'border-gray-200 opacity-60'}`}
          placeholder="Ex: 5511999999999"
          keyboardType="phone-pad"
          value={whatsapp}
          onChangeText={setWhatsapp}
          editable={isAdmin}
        />
        {!isAdmin && (
          <Text className="text-gray-400 text-xs mt-1">Apenas o administrador pode alterar.</Text>
        )}
      </View>

      {isAdmin && (
        <TouchableOpacity
          className="w-full bg-primary h-14 rounded-2xl items-center justify-center mb-6 shadow-sm"
          onPress={salvarConfiguracoes}
          disabled={savingSettings}
        >
          <Text className="text-white font-bold text-lg">
            {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
          </Text>
        </TouchableOpacity>
      )}

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <Text className="font-bold text-gray-900 text-lg mb-3">Clientes</Text>
        <TouchableOpacity 
          className="flex-row items-center border border-gray-200 p-4 rounded-xl bg-surface-background"
          onPress={() => router.push('/clientes')}
        >
          <Ionicons name="people-outline" size={24} color="#374151" />
          <Text className="font-bold text-gray-800 text-lg ml-3">Gerenciar clientes</Text>
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <Text className="font-bold text-primary-dark text-xl mb-2">Equipe</Text>
          <Text className="text-gray-500 text-sm mb-4">
            Convide funcionários para acessar sua conta. Eles usarão o próprio celular para registrar as inseminações.
          </Text>
          <TouchableOpacity 
            className="bg-primary py-4 rounded-xl items-center"
            onPress={gerarConvite}
          >
            <Text className="text-white font-bold text-lg">Convidar via WhatsApp</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        className="w-full bg-white border border-danger h-16 rounded-2xl items-center justify-center mt-2 mb-12"
        onPress={handleLogout}
      >
        <Text className="text-danger font-bold text-xl">Sair do Aplicativo</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
