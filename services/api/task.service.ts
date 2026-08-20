import type { Task } from '@/data/mock';
import { http } from '@/services/http';
import type { TaskService } from '@/services/types';

/**
 * Expected backend endpoints:
 *   GET    /tasks/today          → Task[]
 *   POST   /tasks                → Task (with server-assigned id)
 *   PUT    /tasks/:id            → void
 *   DELETE /tasks/:id            → void
 *   PATCH  /tasks/:id/done       → void
 *   PATCH  /tasks/:id/undo       → void
 */
export const taskService: TaskService = {
  getTodayTasks: ()              => http.get<Task[]>('/tasks/today'),
  create:        (task)          => http.post<Task>('/tasks', task),
  update:        (id, patch)     => http.put<void>(`/tasks/${id}`, patch),
  delete:        (id)            => http.delete(`/tasks/${id}`),
  markDone:      (id)            => http.patch<void>(`/tasks/${id}/done`),
  undoMarkDone:  (id)            => http.patch<void>(`/tasks/${id}/undo`),
};
