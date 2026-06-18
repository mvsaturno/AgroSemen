import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, SectionList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BREEDS_CORTE, BREEDS_LEITE, isKnownBreed } from '../src/constants/breeds';

interface RacaSelectModalProps {
  visible: boolean;
  onClose: () => void;
  racaSelecionada: string;
  onSelect: (raca: string) => void;
}

export default function RacaSelectModal({ visible, onClose, racaSelecionada, onSelect }: RacaSelectModalProps) {
  const [busca, setBusca] = useState('');

  const sections = [
    {
      title: 'Corte',
      data: BREEDS_CORTE.filter(b => b.toLowerCase().includes(busca.toLowerCase()))
    },
    {
      title: 'Leite / Dupla Aptidão',
      data: BREEDS_LEITE.filter(b => b.toLowerCase().includes(busca.toLowerCase()))
    }
  ].filter(s => s.data.length > 0);

  const isCustom = racaSelecionada !== '' && !isKnownBreed(racaSelecionada);

  const handleSelect = (raca: string) => {
    onSelect(raca);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-surface-background rounded-t-3xl h-[80%] shadow-lg">
          
          <View className="flex-row justify-between items-center p-6 border-b border-gray-100">
            <Text className="text-xl font-bold text-gray-900">Selecionar Raça</Text>
            <TouchableOpacity onPress={onClose} className="bg-gray-100 p-2 rounded-full">
              <Ionicons name="close" size={24} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <View className="p-4 border-b border-gray-100 bg-white">
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                className="flex-1 ml-2 text-base text-gray-900"
                placeholder="Buscar raça..."
                value={busca}
                onChangeText={setBusca}
              />
              {busca.length > 0 && (
                <TouchableOpacity onPress={() => setBusca('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section: { title } }) => (
              <View className="bg-surface-background px-6 py-2 border-b border-gray-100">
                <Text className="font-bold text-gray-500 uppercase text-xs">{title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`px-6 py-4 border-b border-gray-100 bg-white flex-row justify-between items-center`}
                onPress={() => handleSelect(item)}
              >
                <Text className={`text-base ${racaSelecionada === item ? 'font-bold text-primary-dark' : 'text-gray-900'}`}>
                  {item}
                </Text>
                {racaSelecionada === item && (
                  <Ionicons name="checkmark-circle" size={24} color="#1B5E20" />
                )}
              </TouchableOpacity>
            )}
            ListFooterComponent={
              <TouchableOpacity
                className="px-6 py-4 border-b border-gray-100 bg-white flex-row justify-between items-center mb-8"
                onPress={() => handleSelect('Outra (Digitar...)')}
              >
                <Text className={`text-base ${isCustom || racaSelecionada === 'Outra (Digitar...)' ? 'font-bold text-primary-dark' : 'text-gray-900'}`}>
                  Outra (Digitar...)
                </Text>
                {(isCustom || racaSelecionada === 'Outra (Digitar...)') && (
                  <Ionicons name="checkmark-circle" size={24} color="#1B5E20" />
                )}
              </TouchableOpacity>
            }
          />
        </View>
      </View>
    </Modal>
  );
}
