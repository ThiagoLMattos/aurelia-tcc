/**
 * Dii, Aurélia's voice: an open-source Brazilian neural voice (Piper/VITS, by TigreGotico, CC BY-NC-ND
 * 4.0) synthesised on the elder's phone with sherpa-onnx. Nothing is sent anywhere to speak.
 *
 * The model (~67 MB) is not in the APK: the elder phone downloads it once, from sherpa-onnx's releases,
 * and keeps it. Until then, and on the web or in Expo Go (no native module), `diiStatus()` is not
 * 'ready' and the app speaks with the phone's own voice instead.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { applyEffectsAudioMode } from '@/sound';

import { DII_SPEED, speakable, splitForSpeech } from './speech';

type Fs = typeof import('@dr.pogodin/react-native-fs');
type Tts = typeof import('react-native-sherpa-onnx/tts');
type Extraction = typeof import('react-native-sherpa-onnx/extraction');
type TtsEngine = Awaited<ReturnType<Tts['createTTS']>>;

const MODEL = {
  id: 'vits-piper-pt_BR-dii-high',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-pt_BR-dii-high.tar.bz2',
  bytes: 67_238_016,
};

export type DiiStatus =
  | { state: 'unavailable' }
  | { state: 'missing' }
  | { state: 'downloading'; progress: number }
  | { state: 'unpacking' }
  | { state: 'ready' }
  | { state: 'failed' };

let status: DiiStatus = { state: 'missing' };
const listeners = new Set<() => void>();

function setStatus(next: DiiStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

export function diiStatus(): DiiStatus {
  return status;
}

export function subscribeDii(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The native modules, or null where they do not exist (web, Expo Go, tests). */
function native(): { fs: Fs; tts: Tts; extraction: Extraction } | null {
  if (Platform.OS === 'web') return null;
  try {
    // Required lazily: importing them where the native code is missing would throw at startup.
    /* eslint-disable @typescript-eslint/no-require-imports */
    return {
      fs: require('@dr.pogodin/react-native-fs') as Fs,
      tts: require('react-native-sherpa-onnx/tts') as Tts,
      extraction: require('react-native-sherpa-onnx/extraction') as Extraction,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    return null;
  }
}

let preparing: Promise<string | null> | null = null;
let engine: Promise<TtsEngine> | null = null;

/** The folder holding the model files, wherever the archive's top folder landed. */
async function modelDir(fs: Fs, root: string): Promise<string | null> {
  for (const dir of [`${root}/${MODEL.id}`, root]) {
    if ((await fs.exists(`${dir}/tokens.txt`)) && (await fs.exists(`${dir}/espeak-ng-data`))) return dir;
  }
  return null;
}

/**
 * Makes sure Dii is on the phone: downloads and unpacks it the first time. Safe to call often; one
 * attempt runs at a time and a failure is retried on the next call (the next app start).
 */
export function prepareDii(): Promise<string | null> {
  preparing ??= (async () => {
    const mods = native();
    if (!mods) {
      setStatus({ state: 'unavailable' });
      return null;
    }
    const { fs, extraction } = mods;
    const root = `${fs.DocumentDirectoryPath}/voices`;
    const done = `${root}/${MODEL.id}.ready`;
    try {
      if (await fs.exists(done)) {
        const dir = await modelDir(fs, root);
        if (dir) {
          setStatus({ state: 'ready' });
          return dir;
        }
      }
      await fs.mkdir(root);
      const archive = `${fs.CachesDirectoryPath}/${MODEL.id}.tar.bz2`;
      setStatus({ state: 'downloading', progress: 0 });
      const download = fs.downloadFile({
        fromUrl: MODEL.url,
        toFile: archive,
        progressInterval: 1000,
        begin: () => undefined,
        progress: ({ bytesWritten }) => setStatus({ state: 'downloading', progress: Math.min(1, bytesWritten / MODEL.bytes) }),
      });
      const result = await download.promise;
      const size = Number((await fs.stat(archive)).size);
      if (result.statusCode !== 200 || size !== MODEL.bytes) throw new Error(`download failed (${result.statusCode}, ${size} bytes)`);

      setStatus({ state: 'unpacking' });
      const unpacked = await extraction.extractArchive({ modelId: MODEL.id, archivePath: archive, format: 'tar.bz2', fileSize: size }, root, { force: true });
      await fs.unlink(archive).catch(() => undefined);
      const dir = unpacked.success ? await modelDir(fs, root) : null;
      if (!dir) throw new Error('unpacking failed');
      await fs.writeFile(done, MODEL.url, 'utf8');
      setStatus({ state: 'ready' });
      return dir;
    } catch (error) {
      console.warn('[dii] not ready:', error);
      setStatus({ state: 'failed' });
      preparing = null;
      return null;
    }
  })();
  return preparing;
}

function getEngine(tts: Tts, dir: string): Promise<TtsEngine> {
  engine ??= tts.createTTS({ modelPath: { type: 'file', path: dir }, modelType: 'vits', numThreads: 2 }).catch((error: unknown) => {
    engine = null;
    throw error;
  });
  return engine;
}

/** Bumped by every new speech and by stop(): an older speech notices and goes quiet. */
let generation = 0;
let playing: ReturnType<typeof createAudioPlayer> | null = null;
let clip = 0;

export function stopDii(): void {
  generation++;
  if (playing) {
    try {
      playing.pause();
      playing.remove();
    } catch {
      // Already released.
    }
    playing = null;
  }
}

function play(path: string, mine: number): Promise<void> {
  return new Promise((resolve) => {
    if (mine !== generation) return resolve();
    const player = createAudioPlayer({ uri: path.startsWith('file://') ? path : `file://${path}` });
    playing = player;
    const finish = () => {
      subscription.remove();
      clearInterval(watch);
      if (playing === player) {
        player.remove();
        playing = null;
      }
      resolve();
    };
    const subscription = player.addListener('playbackStatusUpdate', (update) => {
      if (update.didJustFinish) finish();
    });
    // stop() removes the player without a "finished" event; notice that too.
    const watch = setInterval(() => {
      if (mine !== generation) finish();
    }, 200);
    player.play();
  });
}

/**
 * Speaks `text` with Dii, sentence by sentence: the next piece is synthesised while the current one
 * plays, so she starts talking after the first sentence. Resolves when she is done or was stopped;
 * rejects only when Dii could not speak at all (the caller then uses the phone's voice).
 */
export async function speakWithDii(text: string): Promise<void> {
  const mods = native();
  const dir = status.state === 'ready' && mods ? await prepareDii() : null;
  if (!mods || !dir) throw new Error('Dii is not ready');
  stopDii();
  const mine = generation;
  const pieces = splitForSpeech(speakable(text));
  if (pieces.length === 0) return;

  const tts = await getEngine(mods.tts, dir);
  // Plays even with the iPhone's silent switch on, and leaves any recording mode the microphone set.
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', allowsRecording: false }).catch(() => undefined);

  const synthesize = async (piece: string) => {
    const audio = await tts.generateSpeech(piece, { speed: DII_SPEED });
    const path = `${mods.fs.CachesDirectoryPath}/aurelia-${clip++ % 8}.wav`;
    await mods.tts.saveAudioToFile(audio, path);
    return path;
  };

  let next = synthesize(pieces[0]!);
  try {
    for (let i = 0; i < pieces.length; i++) {
      const path = await next;
      if (mine !== generation) return;
      if (i + 1 < pieces.length) next = synthesize(pieces[i + 1]!);
      await play(path, mine);
      if (mine !== generation) return;
    }
  } finally {
    // A piece still being prepared when she was stopped is simply dropped.
    next.catch(() => undefined);
    if (mine === generation) await applyEffectsAudioMode().catch(() => undefined);
  }
}
