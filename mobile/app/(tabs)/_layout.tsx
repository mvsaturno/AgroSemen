import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { SyncEngine } from '../../src/services/syncEngine';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store';

function OfflineBadge() {
  const netInfo = useNetInfo();
  
  // Efeito para rodar o Sync quando a rede voltar
  useEffect(() => {
    if (netInfo.isConnected) {
      SyncEngine.sync();
    }
  }, [netInfo.isConnected]);

  if (netInfo.isConnected) return null;

  return (
    <View className="bg-warning px-2 py-1 rounded mx-3">
      <Text className="text-white text-xs font-bold">Offline</Text>
    </View>
  );
}

export default function TabLayout() {
  const authUser = useAuthStore(state => state.user);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B5E20',
        tabBarStyle: { 
          backgroundColor: '#FFFFFF', 
          borderTopColor: '#E8F5E9',
          height: 105,
          paddingBottom: 16,
          paddingTop: 12,
        },
        tabBarIconStyle: {
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
          marginTop: 4,
        },
        headerStyle: { backgroundColor: '#1B5E20' },
        headerTintColor: '#FFFFFF',
        headerRight: () => (
          <View className="flex-row items-center pr-4">
            <OfflineBadge />
            <Text className="text-white text-sm font-bold">Olá, {authUser?.nome}</Text>
          </View>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerShown: false,
          tabBarLabel: 'Início',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={36} color={color} />,
        }}
      />
      <Tabs.Screen
        name="estoque"
        options={{
          title: 'Estoque',
          tabBarLabel: 'Estoque',
          tabBarIcon: ({ color }) => <Ionicons name="cube" size={36} color={color} />,
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarLabel: 'Histórico',
          tabBarIcon: ({ color }) => <Ionicons name="time" size={36} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compras"
        options={{
          title: 'Compras',
          tabBarLabel: 'Compras',
          tabBarIcon: ({ color }) => <Ionicons name="cart" size={36} color={color} />,
        }}
      />
      <Tabs.Screen
        name="configuracoes"
        options={{
          title: 'Ajustes',
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={36} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inseminar"
        options={{
          href: null,
          title: 'Nova Inseminação',
        }}
      />
      <Tabs.Screen
        name="entrada-estoque"
        options={{
          href: null,
          title: 'Entrada de Estoque',
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          href: null,
          headerShown: false,
          title: 'Clientes',
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          href: null,
          title: 'Pedidos do Catálogo',
        }}
      />
    </Tabs>
  );
}
