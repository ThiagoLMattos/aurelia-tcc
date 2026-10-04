import { Router } from 'express';
import { SOSController } from '../controllers/SOSController';
import { FirestoreSOSEventRepository } from '../../infrastructure/database/FirestoreSOSEventRepository';
import { TriggerSOSEvent } from '../../domain/use-cases/TriggerSOSEvent';

const sosRoutes = Router();

const repository = new FirestoreSOSEventRepository();
const useCase = new TriggerSOSEvent(repository);
const controller = new SOSController(useCase);

sosRoutes.post('/sos', (req, res) => controller.trigger(req, res));

export default sosRoutes;