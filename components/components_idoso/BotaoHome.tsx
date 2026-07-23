import React, { ReactNode } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

// Definimos o tipo das propriedades que o botao vai receber
type PropriedadesBotao = {
  children: ReactNode;
  aoPressionar: () => void;
  corDeFundo?: string;
  estiloAdicional?: ViewStyle;
};

export default function BotaoHome({
  children,
  aoPressionar,
  corDeFundo = 'rgba(255, 255, 255, 0.1)',
  estiloAdicional,
}: PropriedadesBotao) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        estilos.botao,
        { backgroundColor: corDeFundo },
        estiloAdicional,
      ]}
      onPress={aoPressionar}
    >
      {children}
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 50,
  },
});