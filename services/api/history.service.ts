import type { DayHistory } from '@/data/mock';
import { http } from '@/services/http';
import type { HistoryService } from '@/services/types';

/**
 * Expected backend endpoints:
 *   GET /history/weeks   → DayHistory[][] (oldest → newest)
 */
export const historyService: HistoryService = {
  getWeeks: () => http.get<DayHistory[][]>('/history/weeks'),
};
