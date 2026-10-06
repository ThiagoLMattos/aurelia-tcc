import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { chooseVoice, nextVoice, rankVoices, SPEECH_LANGUAGE, SPEECH_RATE, speakable, type VoiceInfo } from './speech';

const STORAGE_KEY = 'aurelia.voice';
const SAMPLE = 'Olá! Esta é a minha nova voz. Gostou?';

async function loadVoices(): Promise<VoiceInfo[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (voices.length > 0) return voices;
    // Android's speech engine can answer empty while it is still starting.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
}

/** Speaks as Aurélia, in the chosen (or best) voice; `changeVoice` moves to the next one and says a sample. */
export function useAureliaVoice() {
  const [ranked, setRanked] = useState<VoiceInfo[]>([]);
  const [voice, setVoice] = useState<VoiceInfo | null>(null);
  const voiceRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [voices, saved] = await Promise.all([loadVoices(), AsyncStorage.getItem(STORAGE_KEY).catch(() => null)]);
      if (!alive) return;
      const best = rankVoices(voices);
      const chosen = chooseVoice(best, saved);
      voiceRef.current = chosen?.identifier;
      setRanked(best);
      setVoice(chosen);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const speak = useCallback((text: string) => {
    const words = speakable(text);
    if (!words) return;
    Speech.stop();
    Speech.speak(words, {
      language: SPEECH_LANGUAGE,
      voice: voiceRef.current,
      rate: SPEECH_RATE,
      // iOS: its own audio session, so the microphone and the sound effects never leave her muffled.
      useApplicationAudioSession: false,
    });
  }, []);

  const changeVoice = useCallback(() => {
    const next = nextVoice(ranked, voiceRef.current ?? null);
    if (!next) return;
    voiceRef.current = next.identifier;
    setVoice(next);
    void AsyncStorage.setItem(STORAGE_KEY, next.identifier).catch(() => undefined);
    speak(SAMPLE);
  }, [ranked, speak]);

  return { speak, changeVoice, voice, canChange: ranked.length > 1 };
}
