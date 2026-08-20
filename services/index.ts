/**
 * Aurélia — Service exports
 *
 * This file is the only place in the app that knows about USE_MOCK.
 * All other files import from here and never import mock/api directly.
 *
 * To switch to the real backend: set USE_MOCK = false in config/env.ts.
 * Nothing else needs to change.
 */

import { USE_MOCK } from '@/config/env';

import { contactService  as mockContactService  } from './mock/contact.service';
import { elderService    as mockElderService    } from './mock/elder.service';
import { geofenceService as mockGeofenceService } from './mock/geofence.service';
import { historyService  as mockHistoryService  } from './mock/history.service';
import { settingsService as mockSettingsService } from './mock/settings.service';
import { taskService     as mockTaskService     } from './mock/task.service';

import { contactService  as apiContactService  } from './api/contact.service';
import { elderService    as apiElderService    } from './api/elder.service';
import { geofenceService as apiGeofenceService } from './api/geofence.service';
import { historyService  as apiHistoryService  } from './api/history.service';
import { settingsService as apiSettingsService } from './api/settings.service';
import { taskService     as apiTaskService     } from './api/task.service';

export const taskService     = USE_MOCK ? mockTaskService     : apiTaskService;
export const elderService    = USE_MOCK ? mockElderService    : apiElderService;
export const contactService  = USE_MOCK ? mockContactService  : apiContactService;
export const historyService  = USE_MOCK ? mockHistoryService  : apiHistoryService;
export const settingsService = USE_MOCK ? mockSettingsService : apiSettingsService;
export const geofenceService = USE_MOCK ? mockGeofenceService : apiGeofenceService;

export type { Caregiver } from './types';
