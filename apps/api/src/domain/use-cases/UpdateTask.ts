import { Task } from "../entities/Task";
import { TaskRepository } from "../repositories/TaskRepository";

export class UpdateTask {
    constructor(private taskRepository: TaskRepository) {}

    async execute(taskId: string, data: Partial<Task>): Promise<void> {
        if (!taskId) {
            throw new Error("O ID da tarefa é obrigatório.");
        }

        if (data.status === "completed") {
            await this.taskRepository.update(taskId, { ...data, status: "completed" });
            return;
        }

        await this.taskRepository.update(taskId, data);
    }
}
