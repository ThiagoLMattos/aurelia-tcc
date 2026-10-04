import type { Elder } from '@/data/mock';
import { http } from '@/services/http';
import type { ElderService } from '@/services/types';

/**
 * Expected backend endpoints:
 *   GET   /elder      → Elder
 *   PATCH /elder      → void
 */
export const elderService: ElderService = {
  getElder: ()      => http.get<Elder>('/elder'),
  update:   (patch) => http.patch<void>('/elder', patch),
};
