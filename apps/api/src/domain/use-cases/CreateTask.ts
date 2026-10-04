import type { Task } from "../entities/Task";
import type { TaskRepository } from "../repositories/TaskRepository";

export class CreateTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskData: Omit<Task, "id" | "status">): Promise<Task> {
    if (!taskData.title || !taskData.patientId) {
      throw new Error("Título e ID do paciente são obrigatórios.");
    }

    const newTask: Task = {
      ...taskData,
      status: "pending",
    };

    return this.taskRepository.create(newTask);
  }
}

