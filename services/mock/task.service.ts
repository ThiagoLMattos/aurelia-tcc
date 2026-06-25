import { MOCK_TASKS_TODAY } from '@/data/mock';
import type { TaskService } from '@/services/types';

export const taskService: TaskService = {
  getTodayTasks: async () => MOCK_TASKS_TODAY,

  create: async (task) => ({
    ...task,
    id: `task-${Date.now()}`,
    status: 'pending' as const,
  }),

  // Mutations below are no-ops in mock — state is managed optimistically in AppContext.
  update:       async () => {},
  delete:       async () => {},
  markDone:     async () => {},
  undoMarkDone: async () => {},
};
