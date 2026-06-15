import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { useAuthStore } from '@/src/store';

export default function RegisterScreen() {
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [telefone, setTelefone] = useState('');
  const [pin, setPin] = useState('');
  const [nomeFazenda, setNomeFazenda] = useState('');
  const [code, setCode] = useState('');
  const [perfil, setPerfil] = useState<'USO_PROPRIO' | 'PRESTADOR'>('USO_PROPRIO');
  const [step, setStep] = useState<'SELECT_PROFILE' | 'FILL_DETAILS' | 'VERIFY_CODE'>('SELECT_PROFILE');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendCode = async () => {
    if (!nomeUsuario || !telefone || !pin || !nomeFazenda) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    if (pin.length !== 4) {
      Alert.alert('Erro', 'O PIN deve ter exatamente 4 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/send-code', { telefone });
      setStep('VERIFY_CODE');
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao enviar código de verificação. Verifique o número e sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!code || code.length !== 6) {
      Alert.alert('Erro', 'Digite o código de 6 dígitos recebido.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        nomeUsuario,
        telefone,
        pin,
        nomeConta: nomeFazenda,
        code,
        perfil,
      });

      // Efetuar login automático com os dados retornados
      const login = useAuthStore.getState().login;
      await login(response.data);

      Alert.alert('Sucesso', 'Conta criada! Bem-vindo(a) ao AgroSêmen.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
      
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao criar conta. Código incorreto ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-surface-background">
      <View className="flex-1 justify-center items-center px-6 py-10">
        <View className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          
          {step === 'SELECT_PROFILE' ? (
            <>
              <Text className="text-2xl font-bold text-primary-dark mb-2 text-center">Como você vai usar o AgroSêmen?</Text>
              <Text className="text-gray-500 text-center mb-8">Escolha o perfil que melhor descreve você. Pode alterar depois nos Ajustes.</Text>

              <TouchableOpacity 
                className={`w-full rounded-2xl p-4 mb-4 border-2 ${perfil === 'PRESTADOR' ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}
                onPress={() => setPerfil('PRESTADOR')}
              >
                <View className="flex-row items-center">
                  <Text className="text-3xl mr-4">💼</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 mb-1">Prestador de Serviços</Text>
                    <Text className="text-gray-500 text-sm">Uso comercial — registro de valores e clientes</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                className={`w-full rounded-2xl p-4 mb-8 border-2 ${perfil === 'USO_PROPRIO' ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}
                onPress={() => setPerfil('USO_PROPRIO')}
              >
                <View className="flex-row items-center">
                  <Text className="text-3xl mr-4">🚜</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 mb-1">Uso Próprio</Text>
                    <Text className="text-gray-500 text-sm">Produtor rural — sem cobrança de serviço</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                className="w-full bg-[#90b795] py-4 rounded-xl items-center"
                onPress={() => setStep('FILL_DETAILS')}
              >
                <Text className="text-white font-bold text-lg">Avançar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="w-full py-4 mt-2 items-center"
                onPress={() => router.back()}
              >
                <Text className="text-primary-dark font-medium">Voltar para Login</Text>
              </TouchableOpacity>
            </>
          ) : step === 'FILL_DETAILS' ? (
            <>
              <Text className="text-2xl font-bold text-primary-dark mb-2 text-center">Criar Conta</Text>
              <Text className="text-gray-500 text-center mb-8">Administre sua fazenda e convide sua equipe</Text>

              <Text className="text-gray-700 mb-2 font-medium">Nome da Fazenda / Conta</Text>
              <TextInput
                className="w-full bg-surface-background rounded-lg px-4 py-3 mb-4 text-gray-900 border border-gray-200"
                placeholder="Ex: Fazenda São João"
                value={nomeFazenda}
                onChangeText={setNomeFazenda}
              />
              
              <Text className="text-gray-700 mb-2 font-medium">Seu Nome</Text>
              <TextInput
                className="w-full bg-surface-background rounded-lg px-4 py-3 mb-4 text-gray-900 border border-gray-200"
                placeholder="Ex: João da Silva"
                value={nomeUsuario}
                onChangeText={setNomeUsuario}
              />

              <Text className="text-gray-700 mb-2 font-medium">Seu Telefone</Text>
              <TextInput
                className="w-full bg-surface-background rounded-lg px-4 py-3 mb-4 text-gray-900 border border-gray-200"
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                value={telefone}
                onChangeText={setTelefone}
              />

              <Text className="text-gray-700 mb-2 font-medium">PIN (4 dígitos)</Text>
              <TextInput
                className="w-full bg-surface-background rounded-lg px-4 py-3 mb-8 text-gray-900 border border-gray-200"
                placeholder="****"
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                value={pin}
                onChangeText={setPin}
              />

              <TouchableOpacity 
                className="w-full bg-primary py-4 rounded-xl items-center"
                onPress={handleSendCode}
                disabled={loading}
              >
                <Text className="text-white font-bold text-lg">
                  {loading ? 'Enviando...' : 'Enviar Código SMS'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="w-full py-4 mt-2 items-center"
                onPress={() => setStep('SELECT_PROFILE')}
              >
                <Text className="text-primary-dark font-medium">Voltar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-2xl font-bold text-primary-dark mb-2 text-center">Confirmar Telefone</Text>
              <Text className="text-gray-500 text-center mb-8">
                Enviamos um SMS para <Text className="font-bold text-gray-700">{telefone}</Text> com o código de 6 dígitos.
              </Text>

              <Text className="text-gray-700 mb-2 font-medium">Código de 6 dígitos</Text>
              <TextInput
                className="w-full bg-surface-background rounded-lg px-4 py-3 mb-8 text-center text-gray-900 border border-gray-200 text-2xl font-bold tracking-widest"
                placeholder="000000"
                keyboardType="numeric"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />

              <TouchableOpacity 
                className="w-full bg-primary py-4 rounded-xl items-center mb-4"
                onPress={handleRegister}
                disabled={loading}
              >
                <Text className="text-white font-bold text-lg">
                  {loading ? 'Confirmando...' : 'Criar Minha Conta'}
                </Text>
              </TouchableOpacity>

              <View className="flex-row justify-between items-center px-2">
                <TouchableOpacity 
                  onPress={() => setStep('FILL_DETAILS')}
                  disabled={loading}
                >
                  <Text className="text-gray-500 font-medium">Corrigir Número</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleSendCode}
                  disabled={loading}
                >
                  <Text className="text-primary-dark font-medium">Reenviar SMS</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </View>
    </ScrollView>
  );
}
