import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from '@aurelia/shared';
import { randomInt } from 'node:crypto';

export function generatePairingCode(): string {
  let code = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) code += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)];
  return code;
}
