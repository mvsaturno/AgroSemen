import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '@/src/store';
import { api } from '@/src/api/client';
import bcrypt from 'bcryptjs';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [telefone, setTelefone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const loginStore = useAuthStore((state) => state.login);
  const authUser = useAuthStore((state) => state.user);
  const router = useRouter();

  const handleLogin = async () => {
    if (!telefone || !pin) {
      Alert.alert('Erro', 'Preencha o telefone e o PIN.');
      return;
    }

    setLoading(true);
    try {
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        // Validação offline
        if (authUser && authUser.telefone === telefone) {
          const isValid = await bcrypt.compare(pin, authUser.pinHash);
          if (isValid) {
            loginStore({ usuario: authUser, conta: useAuthStore.getState().conta });
          } else {
            Alert.alert('Erro', 'PIN incorreto (Modo Offline).');
          }
        } else {
          Alert.alert('Erro', 'Sem conexão e usuário não encontrado localmente.');
        }
        setLoading(false);
        return;
      }

      // Login Online
      const response = await api.post('/auth/login', {
        telefone,
        pin,
      });

      await loginStore(response.data);
      
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-background justify-center items-center px-6">
      <View className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <Text className="text-3xl font-bold text-primary-dark mb-8 text-center">AgroSêmen</Text>
        
        <Text className="text-gray-700 mb-2 font-medium">Telefone</Text>
        <TextInput
          className="w-full bg-surface-background rounded-lg px-4 py-3 mb-4 text-gray-900 border border-gray-200"
          placeholder="(00) 00000-0000"
          keyboardType="phone-pad"
          value={telefone}
          onChangeText={setTelefone}
        />

        <Text className="text-gray-700 mb-2 font-medium">PIN (4 dígitos)</Text>
        <TextInput
          className="w-full bg-surface-background rounded-lg px-4 py-3 mb-6 text-gray-900 border border-gray-200"
          placeholder="****"
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          value={pin}
          onChangeText={setPin}
        />

        <TouchableOpacity 
          className="w-full bg-primary py-4 rounded-xl items-center mb-4"
          onPress={handleLogin}
          disabled={loading}
        >
          <Text className="text-white font-bold text-lg">
            {loading ? 'Acessando...' : 'Acessar Conta'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="w-full bg-surface-background py-4 rounded-xl items-center border border-primary"
          onPress={() => router.push('/register')}
        >
          <Text className="text-primary-dark font-bold text-lg">Criar Nova Fazenda</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}
