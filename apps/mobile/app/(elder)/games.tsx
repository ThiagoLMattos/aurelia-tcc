import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ElderHeader, MIN_TOUCH, type Section } from '@/elder/ui';
import { PatientColors, PatientTypography, Shadow } from '@/theme';

const SECTION: Section = {
  main: PatientColors.gamesMain,
  headerButton: PatientColors.gamesHeaderButton,
  border: PatientColors.gamesHeaderBorder,
  text: PatientColors.gamesHeaderText,
};

// Nenhum jogo está pronto ainda: cada cartão mostra "EM BREVE" no próprio lugar do botão JOGAR.
const GAMES = [
  { id: '1', name: 'Jogo da Memória', image: require('../../assets/images/MemoriaIcon.png') },
  { id: '2', name: 'Jogo da Velha', image: require('../../assets/images/JogoVelhaIcon.png') },
  { id: '3', name: 'Palavras Cruzadas', image: require('../../assets/images/PalavraCruzadaIcon.png') },
  { id: '4', name: 'Memória Sequencial', image: require('../../assets/images/GeniusIcon.png') },
];

export default function JogosIdosoScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="JOGOS" section={SECTION} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {GAMES.map((game) => (
          <View key={game.id} style={styles.gameCard} accessible accessibilityLabel={`${game.name}. Em breve.`}>
            <View style={styles.gameInfo}>
              <Image source={game.image} style={styles.gameIcon} resizeMode="contain" />
              <Text style={[styles.gameName, game.id === '4' && styles.gameNameSmall]}>{game.name}</Text>
            </View>
            <View style={styles.soonBadge}>
              <Text style={styles.soonText}>EM BREVE</Text>
            </View>
          </View>
        ))}
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
  soonText: { color: PatientColors.gamesMain, fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold },
});
