import React, { ReactNode } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

// Definimos o tipo das propriedades que o botão vai receber
type HomeButtonProps = {
  children: ReactNode;
  onPress: () => void;
  backgroundColor?: string;
  customStyle?: ViewStyle;
};

export default function HomeButton({
  children,
  onPress,
  backgroundColor = 'rgba(255, 255, 255, 0.1)',
  customStyle,
}: HomeButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.button,
        { backgroundColor },
        customStyle,
      ]}
      onPress={onPress}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 50,
  },
});