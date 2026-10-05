/**
 * Legacy mock services, only used by the old `AppContext` until the caregiver and elder screens are
 * rewired to the API client in `@/lib/api`. Nothing new should import from here.
 */

import { contactService } from './mock/contact.service';
import { elderService } from './mock/elder.service';
import { geofenceService } from './mock/geofence.service';
import { historyService } from './mock/history.service';
import { settingsService } from './mock/settings.service';
import { taskService } from './mock/task.service';

export { contactService, elderService, geofenceService, historyService, settingsService, taskService };

export type { Caregiver } from './types';
