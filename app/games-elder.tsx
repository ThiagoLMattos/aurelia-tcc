// @ts-nocheck

import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// ─── Dados dos jogos — adicionar rotas quando as telas estiverem prontas ─────
const GAMES = [
  {
    id: '1',
    name: 'Jogo da Memória',
    image: require('@/assets/images/MemoriaIcon.png'),
    route: '/jogos/memoria',
  },
  {
    id: '2',
    name: 'Jogo da Velha',
    image: require('@/assets/images/JogoVelhaIcon.png'),
    route: '/jogos/velha',
  },
  {
    id: '3',
    name: 'Palavras Cruzadas',
    image: require('@/assets/images/PalavraCruzadaIcon.png'),
    route: '/jogos/cruzadas',
  },
  {
    id: '4',
    name: 'Memória Sequencial',
    image: require('@/assets/images/GeniusIcon.png'),
    route: '/jogos/sequencial',
  },
];

// ─── Componente principal ────────────────────────────────────────────────────
export default function JogosIdosoScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.gamesMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>JOGOS</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.headerButtonText}>VOLTAR</Text>
        </TouchableOpacity>
      </View>

      {/* ── Lista de jogos ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {GAMES.map((game) => (
          <View key={game.id} style={styles.gameCard}>

            {/* Ícone + nome */}
            <View style={styles.gameInfo}>
                <Image source={game.image} style={styles.gameIcon} resizeMode="contain" />
                    <Text style={[
                        styles.gameName,
                        game.id === '4' && styles.gameNameSmall,
                    ]}>
                        {game.name}
                    </Text>
            </View>

            {/* Botão jogar */}
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => router.push('/games-elder-embreve' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.playButtonText}>JOGAR</Text>
            </TouchableOpacity>

          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: PatientColors.gamesMain,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    height: Layout.headerHeight,
    zIndex: 1,
    ...Shadow.header,
  },
  headerTitle: {
    color: PatientColors.gamesHeaderText,
    fontSize: PatientTypography.size.header,
    fontWeight: PatientTypography.weight.regular,
  },
  headerButton: {
    backgroundColor: PatientColors.gamesHeaderButton,
    borderWidth: 1.5,
    borderColor: PatientColors.gamesHeaderBorder,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerButtonText: {
    color: PatientColors.gamesHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.regular,
  },

  // ── Lista ────────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 0,
  },
  gameCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#2C2C2C',
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  gameInfo: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  gameIcon: {
    width: 80,
    height: 80,
  },
  gameName: {
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.regular,
    color: '#2C2C2A',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  gameNameSmall: {
    fontSize: 21,
  },

  // ── Botão jogar ──────────────────────────────────────────────────────────────
  playButton: {
    backgroundColor: PatientColors.gamesMain,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PatientColors.gamesHeaderButton,
    minWidth: 140,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  playButtonText: {
    color: PatientColors.gamesHeaderText,
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
  },
});