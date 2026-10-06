import { describe, expect, it } from 'vitest';

import { joinTranscript, voiceErrorMessage } from '@/elder/voice';

describe('joinTranscript', () => {
  it('joins the finished stretches with the one still being heard', () => {
    expect(joinTranscript(['que horas', ' é o remédio '], 'da noite')).toBe('que horas é o remédio da noite');
    expect(joinTranscript([], '  ')).toBe('');
    expect(joinTranscript(['oi'], '')).toBe('oi');
  });
});

describe('voiceErrorMessage', () => {
  it('stays quiet when listening was cancelled and explains everything else', () => {
    expect(voiceErrorMessage('aborted')).toBeNull();
    expect(voiceErrorMessage('no-speech')).toMatch(/Não ouvi/);
    expect(voiceErrorMessage('not-allowed')).toMatch(/permissão/);
    expect(voiceErrorMessage('network')).toMatch(/internet/);
    expect(voiceErrorMessage('something-new')).toMatch(/Tente de novo/);
  });
});
