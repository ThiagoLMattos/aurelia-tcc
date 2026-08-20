import { MOCK_ELDER } from '@/data/mock';
import type { ElderService } from '@/services/types';

export const elderService: ElderService = {
  getElder: async () => MOCK_ELDER,

  // No-op — state is managed optimistically in AppContext.
  update: async () => {},
};
