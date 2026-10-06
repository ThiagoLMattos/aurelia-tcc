import type { PushData } from '@aurelia/shared';
import { describe, expect, it } from 'vitest';

import { parsePushData, routeForPush } from '@/push/routing';

const data = (type: PushData['type'], eventId?: string): PushData => ({ type, elderId: 'elder-1', ...(eventId ? { eventId } : {}) });

describe('routeForPush', () => {
  it('opens the breach screen for a geofence exit', () => {
    expect(routeForPush(data('geofenceExit', 'evt-1'), 'caregiver')).toEqual({
      pathname: '/(caregiver)/geo-fence-breach',
      params: { elderId: 'elder-1', eventId: 'evt-1' },
    });
  });

  it('opens the SOS alert for an SOS', () => {
    expect(routeForPush(data('sos', 'evt-2'), 'caregiver')).toEqual({
      pathname: '/(caregiver)/sos-alert',
      params: { elderId: 'elder-1', eventId: 'evt-2' },
    });
  });

  it('opens the agenda for a missed task and omits eventId when the push has none', () => {
    expect(routeForPush(data('taskMissed'), 'caregiver')).toEqual({ pathname: '/(caregiver)/(tabs)' });
    expect(routeForPush(data('sos'), 'caregiver').params).toEqual({ elderId: 'elder-1' });
  });

  it('sends the other events somewhere sensible', () => {
    expect(routeForPush(data('taskDone'), 'caregiver').pathname).toBe('/(caregiver)/(tabs)');
    expect(routeForPush(data('geofenceReturn'), 'caregiver').pathname).toBe('/(caregiver)/(tabs)/history');
    expect(routeForPush(data('contactsAlerted'), 'caregiver').pathname).toBe('/(caregiver)/(tabs)/history');
    expect(routeForPush(data('dailySummary'), 'caregiver').pathname).toBe('/(caregiver)/(tabs)/history');
    expect(routeForPush(data('deviceOffline'), 'caregiver').pathname).toBe('/(caregiver)/(tabs)/profile');
  });

  it('keeps an elder phone on its own side whatever the push says', () => {
    expect(routeForPush(data('sos'), 'elder')).toEqual({ pathname: '/(elder)' });
  });
});

describe('parsePushData', () => {
  it('accepts the API payload and ignores anything else', () => {
    expect(parsePushData({ type: 'sos', elderId: 'e1', eventId: 'v1' })).toEqual({ type: 'sos', elderId: 'e1', eventId: 'v1' });
    expect(parsePushData({ type: 'promo', elderId: 'e1' })).toBeNull();
    expect(parsePushData({ type: 'sos' })).toBeNull();
    expect(parsePushData(undefined)).toBeNull();
  });
});

describe('reminder taps', () => {
  it('recognises local reminders and nothing else', async () => {
    const { isReminderData } = await import('@/push/routing');
    expect(isReminderData({ kind: 'reminder' })).toBe(true);
    expect(isReminderData({ type: 'sos' })).toBe(false);
    expect(isReminderData(null)).toBe(false);
  });
});
