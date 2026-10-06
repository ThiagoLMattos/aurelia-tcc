import type { TicTacToeLevel, TicTacToeOutcome } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recordGame } from '@/elder/games/recordGame';
import { elapsedSeconds } from '@/elder/games/results';
import {
  ELDER,
  newTicTacToeGame,
  playElder,
  playPhone,
  TIC_TAC_TOE_LEVELS,
  type TicTacToeState,
} from '@/elder/games/ticTacToe';
import { GameOverCard, GAMES_SECTION, startFeedback, tapFeedback } from '@/elder/games/ui';
import { playSound } from '@/sound';
import { BigButton, ElderHeader } from '@/elder/ui';
import { useElderSelf } from '@/queries';
import { PatientColors, PatientTypography, Shadow } from '@/theme';

/** The phone "thinks" a moment before playing, so the elder sees their own mark first. */
const PHONE_DELAY_MS = 900;
/** The phone's marks, in a colour apart from the elder's purple. */
const PHONE_COLOR = PatientColors.phoneMain;

const LEVELS = Object.entries(TIC_TAC_TOE_LEVELS) as [TicTacToeLevel, (typeof TIC_TAC_TOE_LEVELS)[TicTacToeLevel]][];

const END: Record<TicTacToeOutcome, { title: string; message: string }> = {
  win: { title: 'Você ganhou! 🎉', message: 'Três em linha. Muito bem!' },
  draw: { title: 'Empate!', message: 'Ninguém fez três em linha. Foi um ótimo jogo.' },
  loss: { title: 'O celular ganhou', message: 'Desta vez foi o celular. Vamos jogar de novo?' },
};

/**
 * Jogo da Velha against the phone: the elder is X and always starts. The final board stays on screen
 * above the result, with the winning line marked; the result goes to the caregiver's report.
 */
export default function TicTacToeScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const [level, setLevel] = useState<TicTacToeLevel | null>(null);
  const [game, setGame] = useState<TicTacToeState | null>(null);
  const startedAt = useRef(0);

  function finish(next: TicTacToeState, played: TicTacToeLevel) {
    if (!next.outcome) return;
    if (next.outcome === 'win') tapFeedback('win');
    else if (next.outcome === 'loss') tapFeedback('miss', 'gameOver');
    else tapFeedback('tap', 'draw');
    recordGame(elder.id, { game: 'tictactoe', level: played, outcome: next.outcome, durationSec: elapsedSeconds(startedAt.current) });
  }

  useEffect(() => {
    if (!game || !level || game.outcome || game.turn !== 'phone') return;
    const timer = setTimeout(() => {
      const next = playPhone(game, level);
      playSound('placeO');
      setGame(next);
      finish(next, level);
    }, PHONE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, level]);

  function start(next: TicTacToeLevel) {
    setLevel(next);
    setGame(newTicTacToeGame());
    startedAt.current = Date.now();
    startFeedback();
  }

  function play(index: number) {
    if (!game || !level) return;
    const next = playElder(game, index);
    if (next === game) return;
    setGame(next);
    tapFeedback('tap', 'placeX');
    if (next.outcome) finish(next, level);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="JOGO DA VELHA" titleSize={28} section={GAMES_SECTION} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {!game || !level ? (
          <View style={styles.picker}>
            <Text style={styles.lead}>Faça três em linha antes do celular: na horizontal, na vertical ou na diagonal.</Text>
            <Text style={styles.question}>Como o celular deve jogar?</Text>
            {LEVELS.map(([key, { label, hint }]) => (
              <View key={key} style={styles.levelOption}>
                <BigButton label={label} onPress={() => start(key)} color={PatientColors.gamesMain} textColor={PatientColors.gamesHeaderText} />
                <Text style={styles.hint}>{hint}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.players}>
              <Text style={styles.player}>
                Você: <Text style={styles.markElder}>X</Text>
              </Text>
              <Text style={styles.player}>
                Celular: <Text style={styles.markPhone}>O</Text>
              </Text>
            </View>
            {!game.outcome ? (
              <Text style={styles.status} accessibilityLiveRegion="polite">
                {game.turn === 'elder' ? 'Sua vez! Toque num quadrado vazio.' : 'O celular está pensando…'}
              </Text>
            ) : null}
            <Board game={game} onPlay={play} />
            {game.outcome ? (
              <GameOverCard title={END[game.outcome].title} message={END[game.outcome].message}>
                <BigButton label="JOGAR DE NOVO" onPress={() => start(level)} color={PatientColors.gamesMain} textColor={PatientColors.gamesHeaderText} />
                <BigButton
                  label="MUDAR O NÍVEL"
                  onPress={() => setGame(null)}
                  color={PatientColors.gamesCardBg}
                  textColor={PatientColors.gamesMain}
                  style={styles.outlined}
                />
              </GameOverCard>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Board({ game, onPlay }: { game: TicTacToeState; onPlay: (index: number) => void }) {
  return (
    <View style={styles.board}>
      {[0, 3, 6].map((rowStart) => (
        <View key={rowStart} style={styles.row}>
          {[0, 1, 2].map((col) => {
            const index = rowStart + col;
            const mark = game.board[index];
            const winning = game.line?.includes(index) ?? false;
            const open = !mark && !game.outcome && game.turn === 'elder';
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Linha ${rowStart / 3 + 1}, coluna ${col + 1}: ${mark === ELDER ? 'seu X' : mark ? 'O do celular' : 'vazio'}`}
                accessibilityState={{ disabled: !open }}
                onPress={() => onPlay(index)}
                style={({ pressed }) => [styles.square, winning && styles.squareWinning, pressed && open && styles.squarePressed]}
              >
                {mark ? <Text style={[styles.mark, mark === ELDER ? styles.markElder : styles.markPhone]}>{mark}</Text> : null}
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
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  picker: { gap: 16 },
  lead: { fontSize: PatientTypography.size.common, color: '#2C2C2A', textAlign: 'center', marginVertical: 8 },
  question: { fontSize: PatientTypography.size.common, fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain, textAlign: 'center' },
  levelOption: { gap: 6 },
  hint: { fontSize: PatientTypography.size.minimum, fontWeight: PatientTypography.weight.bold, color: '#5F5E5A', textAlign: 'center' },
  outlined: { borderWidth: 1.5, borderColor: PatientColors.gamesMain },
  players: { flexDirection: 'row', justifyContent: 'space-around' },
  player: { fontSize: PatientTypography.size.common, color: '#2C2C2A' },
  status: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain, textAlign: 'center' },
  board: { gap: 8, backgroundColor: PatientColors.gamesMain, borderRadius: 16, padding: 8, ...Shadow.soft },
  row: { flexDirection: 'row', gap: 8 },
  square: { flex: 1, aspectRatio: 1, backgroundColor: '#FFFFFF', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  squarePressed: { backgroundColor: PatientColors.gamesCardBg },
  squareWinning: { backgroundColor: '#FFE9A8' },
  mark: { fontSize: 64, fontWeight: PatientTypography.weight.bold },
  markElder: { color: PatientColors.gamesMain, fontWeight: PatientTypography.weight.bold },
  markPhone: { color: PHONE_COLOR, fontWeight: PatientTypography.weight.bold },
});
