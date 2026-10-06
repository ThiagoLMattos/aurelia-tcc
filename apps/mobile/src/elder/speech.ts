/**
 * Aurélia's voice. She speaks with Dii, an open-source Brazilian neural voice that runs on the elder's
 * phone (see dii.ts). Until Dii is downloaded, or on a phone where it cannot run, the phone's own
 * text-to-speech is used, with the best Portuguese voice it has.
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

/**
 * Splits text into pieces of whole sentences, at most `max` characters when possible, so the first one
 * can be spoken while the next is being prepared. A sentence longer than `max` is cut at commas.
 */
export function splitForSpeech(text: string, max = 220): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/).flatMap((sentence) =>
    sentence.length <= max ? [sentence] : sentence.split(/(?<=[,;:])\s+/),
  );
  const pieces: string[] = [];
  for (const sentence of sentences.map((s) => s.trim()).filter(Boolean)) {
    const last = pieces.at(-1);
    // The first piece stays a single sentence: the sooner it is ready, the sooner she starts talking.
    if (last !== undefined && pieces.length > 1 && last.length + 1 + sentence.length <= max) pieces[pieces.length - 1] = `${last} ${sentence}`;
    else pieces.push(sentence);
  }
  return pieces;
}

export const SPEECH_LANGUAGE = LANGUAGE;
/** The phone's voices: a little slower than normal, easier to follow. */
export const SPEECH_RATE = 0.9;
/** Dii's pace: the family picked 0.75, calm and clear for older listeners. */
export const DII_SPEED = 0.75;
