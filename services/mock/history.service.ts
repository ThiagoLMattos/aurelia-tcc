import { MOCK_PREV_WEEK_HISTORY, MOCK_WEEK_HISTORY } from '@/data/mock';
import type { HistoryService } from '@/services/types';

export const historyService: HistoryService = {
  // Returns weeks oldest → newest. Add more weeks here as mock data grows.
  getWeeks: async () => [MOCK_PREV_WEEK_HISTORY, MOCK_WEEK_HISTORY],
};
