import { http } from '@/services/http';
import type { GeofenceService } from '@/services/types';

/**
 * Expected backend endpoints:
 *   POST /geofence/breach    { timestamp: string } → void
 *   POST /geofence/resolved  { timestamp: string } → void
 *
 * These endpoints store the event in the elder's history collection
 * so it appears in the Histórico and Relatórios screens.
 */
export const geofenceService: GeofenceService = {
  logBreach:   (ts) => http.post<void>('/geofence/breach',   { timestamp: ts.toISOString() }),
  logResolved: (ts) => http.post<void>('/geofence/resolved', { timestamp: ts.toISOString() }),
};
