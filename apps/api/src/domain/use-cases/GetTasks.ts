import { Task } from "../entities/Task";
import { TaskRepository } from "../repositories/TaskRepository";

export class GetTask {
    constructor(private taskRepository: TaskRepository) {}

    async execute(userId?: string): Promise<Task[]> {
        if (!userId) {
            throw new Error("O ID do usuário é obrigatório.");
        }

        return this.taskRepository.findByUserId(userId);
    }
}
