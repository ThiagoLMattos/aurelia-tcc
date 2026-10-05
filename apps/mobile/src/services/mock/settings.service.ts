import { MOCK_CAREGIVER, MOCK_SETTINGS } from '@/data/mock';
import type { SettingsService } from '@/services/types';

export const settingsService: SettingsService = {
  getCaregiver: async () => MOCK_CAREGIVER,
  getSettings:  async () => MOCK_SETTINGS,

  // No-op — state is managed optimistically in AppContext.
  updateSettings: async () => {},
};
