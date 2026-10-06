import { describe, expect, it } from 'vitest';

import { rankVoices, speakable, splitForSpeech, type VoiceInfo } from '@/elder/speech';

const voice = (identifier: string, language = 'pt-BR', quality = 'Default', name = identifier): VoiceInfo => ({ identifier, name, quality, language });

const IPHONE = [
  voice('com.apple.voice.compact.en-US.Samantha', 'en-US'),
  voice('com.apple.eloquence.pt-BR.Eddy'),
  voice('com.apple.voice.compact.pt-BR.Luciana', 'pt-BR', 'Default', 'Luciana'),
  voice('com.apple.voice.premium.pt-BR.Luciana', 'pt-BR', 'Enhanced', 'Luciana'),
  voice('com.apple.voice.compact.pt-PT.Joana', 'pt-PT', 'Default', 'Joana'),
];

describe('rankVoices', () => {
  it('puts the downloaded Brazilian voice first and leaves out other languages', () => {
    const ranked = rankVoices(IPHONE).map((v) => v.identifier);
    expect(ranked[0]).toBe('com.apple.voice.premium.pt-BR.Luciana');
    expect(ranked[1]).toBe('com.apple.voice.compact.pt-BR.Luciana');
    expect(ranked).not.toContain('com.apple.voice.compact.en-US.Samantha');
    // Portugal's voice comes after every Brazilian one, the robotic Eloquence voice included.
    expect(ranked.at(-1)).toBe('com.apple.voice.compact.pt-PT.Joana');
  });

  it("prefers Android's server voices and reads underscores in the language", () => {
    const ranked = rankVoices([voice('pt-br-x-afs-local', 'pt_BR'), voice('pt-br-x-afs-network', 'pt_BR')]);
    expect(ranked[0]?.identifier).toBe('pt-br-x-afs-network');
  });

  it('is empty when the phone has no Portuguese voice', () => {
    expect(rankVoices([voice('en-us-x-sfg-local', 'en-US')])).toEqual([]);
  });
});

describe('splitForSpeech', () => {
  it('keeps the first sentence alone so she starts talking sooner, then groups the rest', () => {
    expect(splitForSpeech('Bom dia, Maria! Dormiu bem? Hoje está um dia bonito. Vamos tomar o café?')).toEqual([
      'Bom dia, Maria!',
      'Dormiu bem? Hoje está um dia bonito. Vamos tomar o café?',
    ]);
  });

  it('cuts a very long sentence at its commas and never returns empty pieces', () => {
    const long = `${'a'.repeat(150)}, ${'b'.repeat(150)}.`;
    expect(splitForSpeech(long, 220)).toEqual([`${'a'.repeat(150)},`, `${'b'.repeat(150)}.`]);
    expect(splitForSpeech('   ')).toEqual([]);
  });
});

describe('speakable', () => {
  it('drops emoji, markdown and links so they are not read aloud', () => {
    expect(speakable('Bom dia! 😊 Tome o **remédio** às 8h 💊')).toBe('Bom dia! Tome o remédio às 8h');
    expect(speakable('Veja https://exemplo.com.br agora')).toBe('Veja agora');
  });

  it('turns list lines into pauses without doubling punctuation', () => {
    expect(speakable('Hoje você tem:\n- café às 8h\n- almoço às 12h')).toBe('Hoje você tem: café às 8h. almoço às 12h');
    expect(speakable('Tudo certo.\nAté logo!')).toBe('Tudo certo. Até logo!');
  });
});
