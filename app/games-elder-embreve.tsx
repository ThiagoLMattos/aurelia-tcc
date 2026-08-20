// @ts-nocheck

import { PatientColors, PatientTypography } from '@/constants/theme-elder';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function GamesElderEmBreve() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.gamesMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Fundo com texto em diagonal*/}
      <View style={styles.backgroundContainer} pointerEvents="none">
        <Text style={styles.backgroundText}>EM BREVE</Text>
      </View>

      {/* Botão Voltar no rodapé */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>VOLTAR</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-end', // Empurra o conteúdo para o fundo da tela
  },

  // Texto Diagonal no Fundo
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  backgroundText: {
    fontSize: 70,
    fontWeight: 'bold',
    color: PatientColors.gamesMain,
    opacity: 0.15,
    transform: [{ rotate: '-45deg' }],
    textTransform: 'uppercase',
  },

  // Rodapé / Botão Voltar
  footer: {
    paddingHorizontal: 25,
    alignItems: 'center',
    zIndex: 1,
  },
  backButton: {
    backgroundColor: PatientColors.gamesHeaderButton,
    borderWidth: 1.5,
    borderColor: PatientColors.gamesHeaderBorder,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 115,
    alignItems: 'center',
  },
  backButtonText: {
    color: PatientColors.gamesHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.regular,
  },
});