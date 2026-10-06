import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSyncExternalStore } from 'react';

/** Made by scripts/make-sounds.mjs. */
const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  success: require('../../assets/sounds/success.wav'),
  miss: require('../../assets/sounds/miss.wav'),
  celebrate: require('../../assets/sounds/celebrate.wav'),
  send: require('../../assets/sounds/send.wav'),
  receive: require('../../assets/sounds/receive.wav'),
  pad0: require('../../assets/sounds/pad0.wav'),
  pad1: require('../../assets/sounds/pad1.wav'),
  pad2: require('../../assets/sounds/pad2.wav'),
  pad3: require('../../assets/sounds/pad3.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const STORAGE_KEY = 'aurelia.sounds';
const players = new Map<SoundName, AudioPlayer>();
const listeners = new Set<() => void>();
let enabled = true;
let ready: Promise<void> | null = null;

/**
 * Once per app start: reads the on/off choice and sets the audio session. The effects mix with other
 * apps' audio and respect the iPhone's silent switch, like the system's own clicks.
 */
export function initSounds(): Promise<void> {
  ready ??= (async () => {
    try {
      enabled = (await AsyncStorage.getItem(STORAGE_KEY)) !== 'off';
      listeners.forEach((listener) => listener());
      await applyEffectsAudioMode();
    } catch {
      // Sound is a nicety: without storage or an audio session the app just stays quiet or on.
    }
  })();
  return ready;
}

/** The audio session for the effects; Aurélia's voice switches away from it while she speaks. */
export function applyEffectsAudioMode(): Promise<void> {
  return setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
}

/** Plays a short effect; never throws and never waits. Players are created on first use and reused. */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  try {
    let player = players.get(name);
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      players.set(name, player);
    }
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // A missing audio device must never break a button.
  }
}

export function setSoundsEnabled(on: boolean): void {
  enabled = on;
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(STORAGE_KEY, on ? 'on' : 'off').catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The on/off choice, for the settings switch. */
export function useSoundsEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled);
}

/** Wraps a press handler so it clicks first. */
export function withTap<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
  return (...args) => {
    playSound('tap');
    handler(...args);
  };
}
