import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recordGame } from '@/elder/games/recordGame';
import { elapsedSeconds } from '@/elder/games/results';
import {
  finishShowing,
  newSequenceGame,
  nextRound,
  pressPad,
  replay,
  SEQUENCE_PADS,
  type SequenceState,
} from '@/elder/games/sequence';
import { GameOverCard, GAMES_SECTION, tapFeedback } from '@/elder/games/ui';
import { BigButton, ElderHeader } from '@/elder/ui';
import { useElderSelf } from '@/queries';
import { playSound, type SoundName } from '@/sound';
import { PatientColors, PatientTypography } from '@/theme';

/** The phone plays the sequence slowly: each colour stays lit this long, with a pause between. */
const LIT_MS = 800;
const GAP_MS = 400;
/** Pause before the phone starts playing, so the elder is looking at the colours. */
const LEAD_IN_MS = 900;
/** How long a tapped colour flashes. */
const TAP_MS = 250;
const CLEARED_PAUSE_MS = 1_200;
const RETRY_PAUSE_MS = 2_000;
/** One note per pad, low to high, played when it lights up and when it is pressed. */
const PAD_SOUNDS: readonly SoundName[] = ['pad0', 'pad1', 'pad2', 'pad3'];

/**
 * Memória Sequencial: watch the colours light up, then tap them in the same order; one colour more
 * each round. The first mistake replays the sequence, the second ends the game with a kind word.
 */
export default function SequenceGameScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const [game, setGame] = useState<SequenceState | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const latest = useRef<SequenceState | null>(null);
  latest.current = game;

  function record(state: SequenceState) {
    if (recorded.current) return;
    recorded.current = true;
    recordGame(elder.id, {
      game: 'sequence',
      longest: state.longest,
      durationSec: elapsedSeconds(startedAt.current),
    });
  }

  // Leaving in the middle of a game still counts what was already repeated.
  useEffect(
    () => () => {
      const state = latest.current;
      if (state && state.longest > 0) record(state);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!game) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));

    if (game.phase === 'showing') {
      game.sequence.forEach((pad, i) => {
        const on = LEAD_IN_MS + i * (LIT_MS + GAP_MS);
        later(on, () => {
          setLit(pad);
          playSound(PAD_SOUNDS[pad] ?? 'tap');
        });
        later(on + LIT_MS, () => setLit(null));
      });
      later(LEAD_IN_MS + game.sequence.length * (LIT_MS + GAP_MS), () => setGame((s) => s && finishShowing(s)));
    }
    if (game.phase === 'cleared') later(CLEARED_PAUSE_MS, () => setGame((s) => s && nextRound(s)));
    if (game.phase === 'retry') later(RETRY_PAUSE_MS, () => setGame((s) => s && replay(s)));

    return () => {
      timers.forEach(clearTimeout);
      setLit(null);
    };
  }, [game]);

  function start() {
    recorded.current = false;
    startedAt.current = Date.now();
    setGame(newSequenceGame());
  }

  function press(pad: number) {
    if (!game || game.phase !== 'input') return;
    const next = pressPad(game, pad);
    setLit(pad);
    setTimeout(() => setLit((current) => (current === pad ? null : current)), TAP_MS);
    if (next.phase === 'over') {
      tapFeedback('miss');
      record(next);
    } else if (next.phase === 'retry') {
      tapFeedback('miss');
    } else {
      // Each pad sings its own note; the round's last right press is followed by the success chime.
      tapFeedback('tap', PAD_SOUNDS[pad] ?? 'tap');
      if (next.phase === 'cleared') setTimeout(() => playSound('success'), TAP_MS);
    }
    setGame(next);
  }

  const over = game?.phase === 'over';

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="SEQUÊNCIA" titleSize={28} section={GAMES_SECTION} onBack={() => router.back()} />
      <View style={styles.content}>
        {over ? (
          <GameOverCard title="Fim de jogo" message={overMessage(game.longest)}>
            <BigButton
              label="JOGAR DE NOVO"
              onPress={start}
              color={PatientColors.gamesMain}
              textColor={PatientColors.gamesHeaderText}
            />
          </GameOverCard>
        ) : (
          <>
            <Text style={styles.message} accessibilityLiveRegion="polite">
              {messageFor(game)}
            </Text>
            <View style={styles.pads}>
              {[0, 2].map((first) => (
                <View key={first} style={styles.padRow}>
                  {SEQUENCE_PADS.slice(first, first + 2).map((pad, offset) => {
                    const index = first + offset;
                    const on = lit === index;
                    return (
                      <Pressable
                        key={pad.key}
                        accessibilityRole="button"
                        accessibilityLabel={pad.label}
                        accessibilityState={{
                          disabled: game?.phase !== 'input',
                        }}
                        onPress={() => press(index)}
                        style={[styles.pad, { backgroundColor: on ? pad.lit : pad.color }, on && styles.padLit]}
                      >
                        <Text style={[styles.padText, on && styles.padTextLit]}>{pad.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            {game ? (
              <Text
                style={styles.round}
              >{`Sequência de ${game.sequence.length} ${game.sequence.length === 1 ? 'cor' : 'cores'}`}</Text>
            ) : (
              <BigButton
                label="COMEÇAR"
                onPress={start}
                color={PatientColors.gamesMain}
                textColor={PatientColors.gamesHeaderText}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function messageFor(game: SequenceState | null): string {
  if (!game) return 'Observe as cores que acendem. Depois, toque nelas na mesma ordem.';
  switch (game.phase) {
    case 'showing':
      return 'Observe…';
    case 'input':
      return `Sua vez! Toque nas cores na mesma ordem (${game.progress} de ${game.sequence.length}).`;
    case 'cleared':
      return 'Muito bem! 👏 Agora, uma cor a mais.';
    case 'retry':
      return 'Quase! Vamos ver a sequência de novo.';
    case 'over':
      return '';
  }
}

function overMessage(longest: number): string {
  if (longest === 0) return 'Foi um bom começo! Vamos tentar de novo?';
  return `Você lembrou uma sequência de ${longest} ${longest === 1 ? 'cor' : 'cores'}. Muito bem!`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, padding: 16, gap: 16, justifyContent: 'center' },
  message: {
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.bold,
    color: PatientColors.gamesMain,
    textAlign: 'center',
    minHeight: 84,
    textAlignVertical: 'center',
  },
  pads: { gap: 12 },
  padRow: { flexDirection: 'row', gap: 12 },
  pad: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'transparent',
  },
  padLit: { borderColor: '#2C2C2A', transform: [{ scale: 1.04 }] },
  padText: {
    color: '#FFFFFF',
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
  },
  padTextLit: { color: '#2C2C2A' },
  round: {
    fontSize: PatientTypography.size.reduced,
    color: '#2C2C2A',
    textAlign: 'center',
    minHeight: 72,
    textAlignVertical: 'center',
  },
});
