import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { diiStatus, prepareDii, speakWithDii, stopDii, subscribeDii, type DiiStatus } from './dii';
import { rankVoices, SPEECH_LANGUAGE, SPEECH_RATE, speakable } from './speech';

/** The phone's best Portuguese voice, for when Dii is not on the phone yet. */
async function bestPhoneVoice(): Promise<string | undefined> {
  try {
    return rankVoices(await Speech.getAvailableVoicesAsync())[0]?.identifier;
  } catch {
    return undefined;
  }
}

function speakWithPhone(text: string, voice: string | undefined) {
  const words = speakable(text);
  if (!words) return;
  Speech.speak(words, {
    language: SPEECH_LANGUAGE,
    voice,
    rate: SPEECH_RATE,
    // iOS: its own audio session, so the microphone and the sound effects never leave her muffled.
    useApplicationAudioSession: false,
  });
}

/** Dii's download and readiness, for a "preparing the voice" note. */
export function useDiiStatus(): DiiStatus {
  return useSyncExternalStore(subscribeDii, diiStatus);
}

/**
 * Speaks as Aurélia: with Dii once it is on the phone, else with the phone's best Portuguese voice.
 * `stop` silences both.
 */
export function useAureliaVoice() {
  const phoneVoice = useRef<string | undefined>(undefined);

  useEffect(() => {
    void prepareDii();
    void bestPhoneVoice().then((voice) => {
      phoneVoice.current = voice;
    });
  }, []);

  const stop = useCallback(() => {
    stopDii();
    Speech.stop();
  }, []);

  const speak = useCallback(
    (text: string) => {
      stop();
      if (diiStatus().state !== 'ready') {
        speakWithPhone(text, phoneVoice.current);
        return;
      }
      speakWithDii(text).catch((error: unknown) => {
        console.warn('[dii] speaking failed, using the phone voice:', error);
        speakWithPhone(text, phoneVoice.current);
      });
    },
    [stop],
  );

  return { speak, stop };
}
