import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';
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
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === '/';

  return (
    <View className="flex-1 bg-surface-background">
      <Tabs
        screenOptions={{
          tabBarStyle: { display: 'none' },
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
          title: 'Pedidos',
          tabBarLabel: 'Pedidos',
          tabBarIcon: ({ color }) => <Ionicons name="receipt" size={36} color={color} />,
        }}
      />
    </Tabs>
      {!isHome && (
        <View className="bg-surface-background pb-8 pt-3 items-center border-t border-gray-200">
          <TouchableOpacity 
            className="bg-primary-dark w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-primary-dark/40"
            onPress={() => router.push('/')}
          >
            <Ionicons name="home" size={26} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
