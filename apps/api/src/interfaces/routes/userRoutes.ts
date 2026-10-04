import { Router } from 'express';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { UserController } from '../controllers/UserController';
import { FirestoreUserRepository } from '../../infrastructure/database/FirestoreUserRepository';
import { CreateUser } from '../../domain/use-cases/CreateUser';
import { GetUser } from '../../domain/use-cases/GetUser';
import { UpdateUser } from '../../domain/use-cases/UpdateUser';

const router = Router();

const userRepository = new FirestoreUserRepository();
const createUser = new CreateUser(userRepository);
const getUser = new GetUser(userRepository);
const updateUser = new UpdateUser(userRepository);

const userController = new UserController(createUser, getUser, updateUser);

router.use(AuthMiddleware.isAuthenticated);

router.post('/users', (req, res) => userController.create(req, res));
router.get('/user/:userId', (req, res) => userController.getById(req, res));
router.patch('/users/:userId', (req, res) => userController.update(req, res));

export default router;
