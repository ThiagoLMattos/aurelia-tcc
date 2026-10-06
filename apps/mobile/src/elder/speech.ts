/**
 * Aurélia's voice: which of the phone's text-to-speech voices she uses, and how text is cleaned before
 * being read. Phones ship several Portuguese voices of very different quality (iPhones a basic
 * "compact" one, plus enhanced/premium ones once downloaded; Android Google voices, some synthesised on
 * the server). The best one is picked automatically, and "OUTRA VOZ" walks through the rest.
 */

export interface VoiceInfo {
  identifier: string;
  name: string;
  quality: string;
  language: string;
}

const LANGUAGE = 'pt-BR';

function normalizedLanguage(language: string): string {
  return language.replace('_', '-').toLowerCase();
}

/** Higher is better; voices in another language than Portuguese score below zero. */
export function voiceScore(voice: VoiceInfo): number {
  const language = normalizedLanguage(voice.language);
  const id = voice.identifier.toLowerCase();
  let score = language === 'pt-br' ? 100 : language.startsWith('pt') ? 40 : -1000;
  if (id.includes('premium')) score += 30;
  else if (id.includes('enhanced') || voice.quality === 'Enhanced') score += 20;
  // iOS's Eloquence voices (Eddy, Flo, Reed, …) sound robotic; the novelty ones are worse.
  if (id.includes('eloquence')) score -= 50;
  if (id.includes('speech.synthesis')) score -= 80;
  // Android: Google's server voices are the most natural, and Aurélia only works online anyway.
  if (id.includes('network')) score += 5;
  // Luciana is the iPhone's Brazilian woman's voice.
  if (/luciana/i.test(voice.name)) score += 3;
  return score;
}

/** Portuguese voices, best first (Brazilian before Portugal's). */
export function rankVoices(voices: readonly VoiceInfo[]): VoiceInfo[] {
  return voices
    .filter((voice) => voiceScore(voice) > 0)
    .sort((a, b) => voiceScore(b) - voiceScore(a) || a.identifier.localeCompare(b.identifier));
}

/** The voice to use: the saved choice while the phone still has it, else the best one. */
export function chooseVoice(ranked: readonly VoiceInfo[], saved: string | null): VoiceInfo | null {
  return ranked.find((voice) => voice.identifier === saved) ?? ranked[0] ?? null;
}

/** The voice after `current`, wrapping around: what "OUTRA VOZ" switches to. */
export function nextVoice(ranked: readonly VoiceInfo[], current: string | null): VoiceInfo | null {
  if (ranked.length === 0) return null;
  const index = ranked.findIndex((voice) => voice.identifier === current);
  return ranked[(index + 1) % ranked.length] ?? null;
}

/**
 * The text as it should be heard: no emoji (read out as "rosto sorridente"), no markdown marks, no
 * links, and list bullets turned into pauses.
 */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/[*_#`~>|]/g, '')
    .replace(/([.!?:;,])?[ \t]*\n+\s*/g, (_, mark: string | undefined) => (mark ? `${mark} ` : '. '))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const SPEECH_LANGUAGE = LANGUAGE;
/** A little slower than normal: easier to follow, still natural. */
export const SPEECH_RATE = 0.9;
