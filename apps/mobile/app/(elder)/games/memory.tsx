import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  flipCard,
  hideMismatch,
  isMemoryFinished,
  isShowingMismatch,
  matchedPairs,
  MEMORY_LEVELS,
  MEMORY_SYMBOLS,
  newMemoryGame,
  type MemoryLevel,
  type MemoryState,
} from '@/elder/games/memory';
import { recordGame } from '@/elder/games/recordGame';
import { elapsedSeconds } from '@/elder/games/results';
import { GameOverCard, GAMES_SECTION, tapFeedback } from '@/elder/games/ui';
import { BigButton, ElderHeader } from '@/elder/ui';
import { useElderSelf } from '@/queries';
import { PatientColors, PatientTypography, Shadow } from '@/theme';

/** How long a pair that does not match stays face up: enough to look at both pictures calmly. */
const MISMATCH_MS = 1_500;

const LEVELS = Object.entries(MEMORY_LEVELS) as [MemoryLevel, (typeof MEMORY_LEVELS)[MemoryLevel]][];

/**
 * Jogo da Memória: pick a size, then find the pairs. No clock on screen and no way to lose; the time
 * and the number of moves only go to the caregiver's report when every pair is found.
 */
export default function MemoryGameScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const [level, setLevel] = useState<MemoryLevel | null>(null);
  const [game, setGame] = useState<MemoryState | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!game || !isShowingMismatch(game)) return;
    const timer = setTimeout(() => setGame((current) => current && hideMismatch(current)), MISMATCH_MS);
    return () => clearTimeout(timer);
  }, [game]);

  function start(next: MemoryLevel) {
    setLevel(next);
    setGame(newMemoryGame(MEMORY_LEVELS[next].pairs));
    startedAt.current = Date.now();
  }

  function flip(index: number) {
    if (!game || !level) return;
    const next = flipCard(game, index);
    if (next === game) return;
    setGame(next);
    if (isMemoryFinished(next)) {
      tapFeedback('win');
      recordGame(elder.id, { game: 'memory', pairs: MEMORY_LEVELS[level].pairs, moves: next.moves, durationSec: elapsedSeconds(startedAt.current) });
    } else {
      const matched = next.cards.filter((card) => card.matched).length > game.cards.filter((card) => card.matched).length;
      if (matched) tapFeedback('success');
      else if (isShowingMismatch(next)) tapFeedback('miss');
      else tapFeedback('tap', 'flip');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="MEMÓRIA" section={GAMES_SECTION} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {!game || !level ? (
          <LevelPicker onPick={start} />
        ) : isMemoryFinished(game) ? (
          <GameOverCard
            title="Parabéns! 🎉"
            message={`Você encontrou os ${MEMORY_LEVELS[level].pairs} pares em ${game.moves} jogadas.`}
          >
            <BigButton label="JOGAR DE NOVO" onPress={() => start(level)} color={PatientColors.gamesMain} textColor={PatientColors.gamesHeaderText} />
            <BigButton
              label="MUDAR O TAMANHO"
              onPress={() => setGame(null)}
              color={PatientColors.gamesCardBg}
              textColor={PatientColors.gamesMain}
              style={styles.outlined}
            />
          </GameOverCard>
        ) : (
          <Board game={game} columns={MEMORY_LEVELS[level].columns} onFlip={flip} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LevelPicker({ onPick }: { onPick: (level: MemoryLevel) => void }) {
  return (
    <View style={styles.picker}>
      <Text style={styles.lead}>Vire duas cartas de cada vez e encontre as figuras iguais.</Text>
      <Text style={styles.question}>Com quantas cartas você quer jogar?</Text>
      {LEVELS.map(([key, { label, pairs }]) => (
        <BigButton
          key={key}
          label={`${label} · ${pairs * 2} CARTAS`}
          onPress={() => onPick(key)}
          color={PatientColors.gamesMain}
          textColor={PatientColors.gamesHeaderText}
        />
      ))}
    </View>
  );
}

function Board({ game, columns, onFlip }: { game: MemoryState; columns: number; onFlip: (index: number) => void }) {
  const total = game.cards.length / 2;
  const rows: number[][] = [];
  for (let i = 0; i < game.cards.length; i += columns) rows.push(game.cards.slice(i, i + columns).map((card) => card.id));
  const emojiSize = columns > 3 ? 40 : 52;

  return (
    <View style={styles.board}>
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {isShowingMismatch(game) ? 'Não são iguais. Tente lembrar onde estão!' : `Pares encontrados: ${matchedPairs(game)} de ${total}`}
      </Text>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((index) => {
            const card = game.cards[index]!;
            const shown = card.matched || game.faceUp.includes(index);
            const symbol = MEMORY_SYMBOLS[card.symbol]!;
            return (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                accessibilityLabel={shown ? `${symbol.name}${card.matched ? ', par encontrado' : ''}` : `Carta ${index + 1}, virada para baixo`}
                accessibilityState={{ disabled: card.matched }}
                onPress={() => onFlip(index)}
                style={[styles.card, shown ? styles.cardUp : styles.cardDown, card.matched && styles.cardMatched]}
              >
                <Text style={[styles.cardText, { fontSize: emojiSize }, !shown && styles.cardBack]}>{shown ? symbol.emoji : '?'}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 40 },
  picker: { gap: 16 },
  lead: { fontSize: PatientTypography.size.common, color: '#2C2C2A', textAlign: 'center', marginVertical: 8 },
  question: { fontSize: PatientTypography.size.common, fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain, textAlign: 'center' },
  outlined: { borderWidth: 1.5, borderColor: PatientColors.gamesMain },
  board: { gap: 10 },
  status: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain, textAlign: 'center', minHeight: 56 },
  row: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, aspectRatio: 0.9, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, ...Shadow.soft },
  cardDown: { backgroundColor: PatientColors.gamesMain, borderColor: PatientColors.gamesHeaderButton },
  cardUp: { backgroundColor: '#FFFFFF', borderColor: PatientColors.gamesMain },
  cardMatched: { backgroundColor: PatientColors.gamesCardBg, borderColor: PatientColors.gamesHeaderBorder },
  cardText: { textAlign: 'center' },
  cardBack: { color: PatientColors.gamesHeaderBorder, fontWeight: PatientTypography.weight.bold },
});
