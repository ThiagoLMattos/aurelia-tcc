import type { AppSettings } from '@/data/mock';
import { http } from '@/services/http';
import type { Caregiver, SettingsService } from '@/services/types';

/**
 * Expected backend endpoints:
 *   GET   /caregiver/me        → Caregiver
 *   GET   /caregiver/settings  → AppSettings
 *   PATCH /caregiver/settings  → void
 */
export const settingsService: SettingsService = {
  getCaregiver:   ()      => http.get<Caregiver>('/caregiver/me'),
  getSettings:    ()      => http.get<AppSettings>('/caregiver/settings'),
  updateSettings: (patch) => http.patch<void>('/caregiver/settings', patch),
};
