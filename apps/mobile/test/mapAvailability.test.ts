import { describe, expect, it } from 'vitest';

import { canShowNativeMap } from '@/lib/mapAvailability';

describe('canShowNativeMap', () => {
  it('always draws on iOS (Apple Maps needs no key)', () => {
    expect(canShowNativeMap({ os: 'ios', executionEnvironment: 'standalone', androidMapsKey: undefined })).toBe(true);
  });

  it('draws on Android in Expo Go, or in a build with a Google Maps key', () => {
    expect(canShowNativeMap({ os: 'android', executionEnvironment: 'storeClient', androidMapsKey: undefined })).toBe(true);
    expect(canShowNativeMap({ os: 'android', executionEnvironment: 'standalone', androidMapsKey: 'AIza…' })).toBe(true);
  });

  it('falls back to text on an Android build without a key', () => {
    expect(canShowNativeMap({ os: 'android', executionEnvironment: 'standalone', androidMapsKey: undefined })).toBe(false);
  });
});
