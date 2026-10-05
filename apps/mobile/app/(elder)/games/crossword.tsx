import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cellKey,
  cellsOf,
  eraseLetter,
  giveHint,
  isCrosswordFinished,
  newCrosswordGame,
  openCells,
  placeTile,
  stepWord,
  tapCell,
  type CrosswordState,
} from '@/elder/games/crossword';
import { CROSSWORD_PUZZLES, type CrosswordPuzzle } from '@/elder/games/crosswordPuzzles';
import { recordGame } from '@/elder/games/recordGame';
import { elapsedSeconds } from '@/elder/games/results';
import { GameOverCard, GAMES_SECTION, tapFeedback } from '@/elder/games/ui';
import { BigButton, ElderHeader, MIN_TOUCH } from '@/elder/ui';
import { useElderSelf } from '@/queries';
import { PatientColors, PatientTypography, Shadow } from '@/theme';

const SOLVED_BG = PatientColors.tasksHeaderText;
const SOLVED_TEXT = PatientColors.tasksMain;
const GRID_GAP = 4;
/** Big enough to tap, small enough that a 7-letter word's tiles fit on one row. */
const TILE = 46;
const TILE_GAP = 6;

/**
 * Palavras Cruzadas: pick a theme, then fill each word from its picture and clue by tapping letter
 * tiles. No keyboard and no clock; "Dica" fills a letter. The caregiver sees the words found and the
 * hints used, also when the elder stops before the end.
 */
export default function CrosswordScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null);
  const [game, setGame] = useState<CrosswordState | null>(null);
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const latest = useRef<{ puzzle: CrosswordPuzzle | null; game: CrosswordState | null }>({ puzzle: null, game: null });
  latest.current = { puzzle, game };

  function record(played: CrosswordPuzzle, state: CrosswordState) {
    if (recorded.current || state.solved.length === 0) return;
    recorded.current = true;
    recordGame(elder.id, {
      game: 'crossword',
      theme: played.theme,
      words: state.solved.length,
      totalWords: state.layout.words.length,
      hints: state.hints,
      durationSec: elapsedSeconds(startedAt.current),
    });
  }

  // Leaving before the end still counts the words already found.
  useEffect(
    () => () => {
      const { puzzle: played, game: state } = latest.current;
      if (played && state) record(played, state);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function start(next: CrosswordPuzzle) {
    const { puzzle: played, game: state } = latest.current;
    if (played && state && !isCrosswordFinished(state)) record(played, state);
    recorded.current = false;
    startedAt.current = Date.now();
    setPuzzle(next);
    setGame(newCrosswordGame(next));
  }

  function update(next: CrosswordState) {
    if (!game || next === game || !puzzle) return;
    setGame(next);
    if (isCrosswordFinished(next)) {
      tapFeedback('success');
      record(puzzle, next);
    } else if (next.feedback === 'right') tapFeedback('success');
    else if (next.feedback === 'wrong') tapFeedback('miss');
    else tapFeedback();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="CRUZADINHA" titleSize={30} section={GAMES_SECTION} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {!game || !puzzle ? (
          <ThemePicker onPick={start} />
        ) : isCrosswordFinished(game) ? (
          <>
            <Grid game={game} onTap={() => undefined} />
            <GameOverCard
              title="Parabéns! 🎉"
              message={`Você completou a cruzadinha de ${puzzle.theme}${game.hints > 0 ? `, com ${game.hints} ${game.hints === 1 ? 'dica' : 'dicas'}` : ' sem nenhuma dica'}.`}
            >
              <BigButton label="OUTRA CRUZADINHA" onPress={() => setGame(null)} color={PatientColors.gamesMain} textColor={PatientColors.gamesHeaderText} />
            </GameOverCard>
          </>
        ) : (
          <Playing game={game} onChange={update} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ThemePicker({ onPick }: { onPick: (puzzle: CrosswordPuzzle) => void }) {
  return (
    <View style={styles.picker}>
      <Text style={styles.lead}>Descubra as palavras pelas figuras e dicas. Toque nas letras para escrever.</Text>
      <Text style={styles.question}>Escolha um tema:</Text>
      {CROSSWORD_PUZZLES.map((puzzle) => (
        <BigButton
          key={puzzle.id}
          label={`${puzzle.emoji}  ${puzzle.theme.toUpperCase()}`}
          accessibilityLabel={`Tema ${puzzle.theme}`}
          onPress={() => onPick(puzzle)}
          color={PatientColors.gamesMain}
          textColor={PatientColors.gamesHeaderText}
        />
      ))}
    </View>
  );
}

function Playing({ game, onChange }: { game: CrosswordState; onChange: (next: CrosswordState) => void }) {
  const word = game.layout.words[game.selected];
  if (!word) return null;
  const remaining = game.layout.words.length - game.solved.length;

  return (
    <>
      <View style={styles.clueCard}>
        <ArrowButton label="◀" accessibilityLabel="Palavra anterior" disabled={remaining < 2} onPress={() => onChange(stepWord(game, -1))} />
        <View style={styles.clueBody} accessibilityLiveRegion="polite">
          <Text style={styles.clueEmoji}>{word.emoji}</Text>
          <Text style={styles.clueText}>{word.clue}</Text>
          <Text style={styles.clueMeta}>{`${word.answer.length} letras · faltam ${remaining} ${remaining === 1 ? 'palavra' : 'palavras'}`}</Text>
        </View>
        <ArrowButton label="▶" accessibilityLabel="Próxima palavra" disabled={remaining < 2} onPress={() => onChange(stepWord(game, 1))} />
      </View>

      <Text
        style={[styles.feedback, game.feedback === 'right' && styles.feedbackRight, game.feedback === 'wrong' && styles.feedbackWrong]}
        accessibilityLiveRegion="polite"
      >
        {game.feedback === 'right' ? 'Muito bem! Palavra certa ✓' : game.feedback === 'wrong' ? 'Ainda não. Tente de novo!' : ' '}
      </Text>

      <Grid game={game} onTap={(key) => onChange(tapCell(game, key))} />

      <View style={styles.bank}>
        {game.bank.map((letter, index) => (
          <Pressable
            key={`${letter}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Letra ${letter}`}
            onPress={() => onChange(placeTile(game, index))}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <Text style={styles.tileText}>{letter}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <BigButton
          label="APAGAR"
          onPress={() => onChange(eraseLetter(game))}
          disabled={openCells(game).length === cellsOf(word).filter((key) => !game.locked.includes(key)).length}
          color={PatientColors.gamesCardBg}
          textColor={PatientColors.gamesMain}
          style={[styles.action, styles.outlined]}
        />
        <BigButton
          label="💡 DICA"
          accessibilityLabel="Dica: mostra uma letra"
          onPress={() => onChange(giveHint(game))}
          color={PatientColors.gamesCardBg}
          textColor={PatientColors.gamesMain}
          style={[styles.action, styles.outlined]}
        />
      </View>
    </>
  );
}

function ArrowButton({ label, accessibilityLabel, disabled, onPress }: { label: string; accessibilityLabel: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, disabled && { opacity: 0.3 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.arrowText}>{label}</Text>
    </Pressable>
  );
}

function Grid({ game, onTap }: { game: CrosswordState; onTap: (key: string) => void }) {
  const { width } = useWindowDimensions();
  const { rows, cols, words } = game.layout;
  const size = Math.min(44, Math.floor((width - 32 - GRID_GAP * (cols - 1)) / cols));
  const selectedCells = useMemo(() => {
    const word = words[game.selected];
    return word && !game.solved.includes(game.selected) ? cellsOf(word) : [];
  }, [words, game.selected, game.solved]);
  const used = useMemo(() => new Set(words.flatMap(cellsOf)), [words]);
  const nextCell = openCells(game)[0];

  return (
    <View style={styles.grid}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.gridRow}>
          {Array.from({ length: cols }, (_, c) => {
            const key = cellKey(r, c);
            if (!used.has(key)) return <View key={key} style={{ width: size, height: size }} />;
            const letter = game.letters[key];
            const locked = game.locked.includes(key);
            const selected = selectedCells.includes(key);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={letter ? `Letra ${letter}` : 'Quadrado vazio'}
                onPress={() => onTap(key)}
                style={[
                  styles.cell,
                  { width: size, height: size },
                  locked && styles.cellSolved,
                  selected && styles.cellSelected,
                  key === nextCell && styles.cellNext,
                ]}
              >
                <Text style={[styles.cellText, { fontSize: Math.round(size * 0.55) }, locked && !selected && styles.cellTextSolved]}>
                  {letter ?? ''}
                </Text>
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
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  picker: { gap: 14 },
  lead: { fontSize: PatientTypography.size.common, color: '#2C2C2A', textAlign: 'center', marginVertical: 8 },
  question: { fontSize: PatientTypography.size.common, fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain, textAlign: 'center' },
  clueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PatientColors.gamesCardBg,
    borderColor: PatientColors.gamesMain,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 10,
    ...Shadow.soft,
  },
  /** Tall enough for a three-line clue, so the grid below does not jump from word to word. */
  clueBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 150 },
  clueEmoji: { fontSize: 38 },
  clueText: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: '#2C2C2A', textAlign: 'center' },
  clueMeta: { fontSize: PatientTypography.size.minimum, fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain, textAlign: 'center' },
  arrow: { width: 48, minHeight: MIN_TOUCH, borderRadius: 10, backgroundColor: PatientColors.gamesMain, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: PatientColors.gamesHeaderText, fontSize: 22, fontWeight: PatientTypography.weight.bold },
  feedback: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, textAlign: 'center', minHeight: 28 },
  feedbackRight: { color: SOLVED_TEXT },
  feedbackWrong: { color: PatientColors.sosMain },
  grid: { alignItems: 'center', gap: GRID_GAP },
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
  cell: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: PatientColors.gamesHeaderBorder,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSolved: { backgroundColor: SOLVED_BG, borderColor: PatientColors.tasksBorder },
  cellSelected: { backgroundColor: PatientColors.gamesCardBg, borderColor: PatientColors.gamesMain },
  cellNext: { borderWidth: 3 },
  cellText: { fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain },
  cellTextSolved: { color: SOLVED_TEXT },
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: TILE_GAP, marginTop: 8, minHeight: TILE },
  tile: {
    width: TILE,
    height: TILE + 8,
    borderRadius: 10,
    backgroundColor: PatientColors.gamesMain,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  tilePressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  tileText: { color: PatientColors.gamesHeaderText, fontSize: 26, fontWeight: PatientTypography.weight.bold },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  action: { flex: 1, minHeight: 64, paddingVertical: 12 },
  outlined: { borderWidth: 1.5, borderColor: PatientColors.gamesMain },
});
