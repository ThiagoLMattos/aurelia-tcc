import { describe, expect, it } from 'vitest';

import { SHARED_PACKAGE_NAME } from './index';

describe('@aurelia/shared', () => {
  it('exports its package name', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@aurelia/shared');
  });
});
