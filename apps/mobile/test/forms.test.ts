import { SignupBodySchema } from '@aurelia/shared';
import { describe, expect, it } from 'vitest';

import { brDateToIso, maskBrDate, validateForm } from '@/lib/forms';

describe('validateForm', () => {
  const messages = { name: 'Informe seu nome.', email: 'Informe um e-mail válido.', password: 'Senha curta.' };

  it('returns the parsed data when valid', () => {
    const result = validateForm(SignupBodySchema, { name: ' Ana ', email: 'ana@example.com', password: '12345678' }, messages);
    expect(result).toEqual({ ok: true, data: { name: 'Ana', email: 'ana@example.com', password: '12345678' } });
  });

  it('maps every failing field to the form message', () => {
    const result = validateForm(SignupBodySchema, { name: '', email: 'not-an-email', password: '123' }, messages);
    expect(result).toEqual({ ok: false, errors: { name: messages.name, email: messages.email, password: messages.password } });
  });
});

describe('dates', () => {
  it('masks a date while it is typed', () => {
    expect(maskBrDate('1')).toBe('1');
    expect(maskBrDate('150')).toBe('15/0');
    expect(maskBrDate('15031947')).toBe('15/03/1947');
    expect(maskBrDate('15/03/1947999')).toBe('15/03/1947');
  });

  it('converts DD/MM/AAAA to ISO and leaves anything else alone', () => {
    expect(brDateToIso('15/03/1947')).toBe('1947-03-15');
    expect(brDateToIso('15/03')).toBe('15/03');
  });
});
