import { Task } from '../../domain/entities/Task';
import { TaskRepository } from '../../domain/repositories/TaskRepository';
import { getFirestore } from 'firebase-admin/firestore';

export class FirestoreTaskRepository implements TaskRepository {
    private db = getFirestore();
    private collection = this.db.collection('tasks');

    async create(task: Task): Promise<Task> {
        if (!task.id) {
            throw new Error("ID da tarefa é obrigatória para salvar.");
        }
        await this.collection.doc(task.id).set(task);
        return task;
    }

    async findByUserId(userId: string): Promise<Task[]> {
        const snapshot = await this.collection.where('userId', '==', userId).get();

        if (snapshot.empty) {
            return[];
        }

        return snapshot.docs.map(doc => doc.data() as Task);
    }

    async update(taskId: string, data: Partial<Task>): Promise<void> {
        await this.collection.doc(taskId).update(data);
    }

    async delete(taskId: string): Promise<void> {
        await this.collection.doc(taskId).delete();
    }
    
}