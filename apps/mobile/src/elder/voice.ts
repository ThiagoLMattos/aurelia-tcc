/**
 * Pure helpers for "segure para falar" on the elder's assistant screen. Kept apart from the native
 * speech module so they can be tested without a device.
 */

/** Below this, a press was a tap, not a hold: the elder gets a hint instead of an empty message. */
export const MIN_HOLD_MS = 600;

/**
 * What was said so far. Android's continuous mode reports one final result per stretch of speech,
 * so the finished stretches are joined with the one still being heard.
 */
export function joinTranscript(finals: readonly string[], interim: string): string {
  return [...finals, interim]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

/** The hint shown under the button when listening ends without a message; null to stay quiet. */
export function voiceErrorMessage(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'no-speech':
    case 'speech-timeout':
    case 'nomatch':
      return 'Não ouvi nada. Segure o botão e fale perto do celular.';
    case 'not-allowed':
      return 'O Aurélia precisa de permissão para usar o microfone.';
    case 'network':
      return 'Sem internet para entender a sua voz. Tente de novo ou escreva.';
    case 'language-not-supported':
    case 'service-not-allowed':
      return 'Este celular não reconhece voz em português. Escreva a sua mensagem.';
    case 'busy':
      return 'O microfone está ocupado. Tente de novo em instantes.';
    default:
      return 'Não consegui entender. Tente de novo ou escreva.';
  }
}
