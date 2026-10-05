import { useRouter, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GAMES_SECTION } from '@/elder/games/ui';
import { ElderHeader, MIN_TOUCH } from '@/elder/ui';
import { PatientColors, PatientTypography, Shadow } from '@/theme';


// Os jogos sem tela ainda mostram "EM BREVE" no próprio lugar do botão JOGAR.
const GAMES: { id: string; name: string; image: number; href: Href | null }[] = [
  { id: '1', name: 'Jogo da Memória', image: require('../../../assets/images/MemoriaIcon.png'), href: '/(elder)/games/memory' },
  { id: '4', name: 'Memória Sequencial', image: require('../../../assets/images/GeniusIcon.png'), href: '/(elder)/games/sequence' },
  { id: '2', name: 'Jogo da Velha', image: require('../../../assets/images/JogoVelhaIcon.png'), href: null },
  { id: '3', name: 'Palavras Cruzadas', image: require('../../../assets/images/PalavraCruzadaIcon.png'), href: null },
];

export default function JogosIdosoScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="JOGOS" section={GAMES_SECTION} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {GAMES.map((game) => {
          const { href } = game;
          return (
            <View key={game.id} style={styles.gameCard} accessible={!href} accessibilityLabel={href ? undefined : `${game.name}. Em breve.`}>
              <View style={styles.gameInfo}>
                <Image source={game.image} style={styles.gameIcon} resizeMode="contain" />
                <Text style={[styles.gameName, game.id === '4' && styles.gameNameSmall]}>{game.name}</Text>
              </View>
              {href ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Jogar ${game.name}`}
                  onPress={() => router.push(href)}
                  style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.playText}>JOGAR</Text>
                </Pressable>
              ) : (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>EM BREVE</Text>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Lista
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

  soonBadge: {
    backgroundColor: PatientColors.gamesCardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PatientColors.gamesMain,
    minWidth: 140,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  playButton: {
    backgroundColor: PatientColors.gamesMain,
    borderRadius: 10,
    minWidth: 140,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  playText: { color: PatientColors.gamesHeaderText, fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold },
  soonText: { color: PatientColors.gamesMain, fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold },
});
