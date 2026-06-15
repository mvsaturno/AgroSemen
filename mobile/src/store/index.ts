import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  isLoggedIn: boolean;
  user: {
    id: string;
    nome: string;
    telefone: string;
    papel: string;
    pinHash: string;
  } | null;
  conta: {
    id: string;
    nome: string;
    slug: string;
    perfil: string;
    estoqueMinAlerta: number;
    whatsappCatalogo?: string;
    valorPadraoCon: number;
    valorPadraoSex: number;
  } | null;
  login: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      conta: null,

      login: async (data) => {
        if (data.token) {
          await SecureStore.setItemAsync('jwt_token', data.token);
        }
        set({
          isLoggedIn: true,
          user: data.usuario,
          conta: data.conta,
        });
      },

      logout: async () => {
        await SecureStore.deleteItemAsync('jwt_token');
        set({
          isLoggedIn: false,
          user: null,
          conta: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
