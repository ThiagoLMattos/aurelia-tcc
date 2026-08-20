import type { GeofenceService } from '@/services/types';

// In mock mode, breach events are not persisted anywhere — they only
// exist in local React state (AppContext). The backend team will implement
// the real endpoints that store these events in the history collection.
export const geofenceService: GeofenceService = {
  logBreach:   async () => {},
  logResolved: async () => {},
};
