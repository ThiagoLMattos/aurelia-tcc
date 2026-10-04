import { Router } from 'express';
import { TaskController } from '../controllers/TaskController';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { CreateTaskUseCase } from '../../domain/use-cases/CreateTask';
import { FirestoreTaskRepository } from '../../infrastructure/database/FirestoreTaskRepository';

const router = Router();

const taskRepository = new FirestoreTaskRepository();
const createTaskUseCase = new CreateTaskUseCase(taskRepository);

const taskController = new TaskController(createTaskUseCase, taskRepository);

router.use(AuthMiddleware.isAuthenticated);
router.post('/tasks', AuthMiddleware.isRole(['caregiver']), (req, res) => taskController.createTask(req, res));
router.get('/tasks/user/:userId', AuthMiddleware.isRole(['patient', 'caregiver']), (req, res) => taskController.getTasks(req, res));
router.patch('/tasks/:taskId', AuthMiddleware.isRole(['patient', 'caregiver']), (req, res) => taskController.updateTask(req, res));
router.delete('/tasks/:taskId', AuthMiddleware.isRole(['caregiver']), (req, res) => taskController.deleteTask(req, res));

export default router;