import { Router } from 'express';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { DeviceController } from '../controllers/DeviceController';
import { FirestoreDeviceRepository } from '../../infrastructure/database/FirestoreDeviceRepostory';
import { RegisterDevice } from '../../domain/use-cases/RegisterDevice';
import { GetDevicesByPatient } from '../../domain/use-cases/GetDevicesByPatient';
import { UpdateDevice } from '../../domain/use-cases/UpdateDevice';

const router = Router();

const deviceRepository = new FirestoreDeviceRepository();
const registerDevice = new RegisterDevice(deviceRepository);
const getDevices = new GetDevicesByPatient(deviceRepository);
const updateDevice = new UpdateDevice(deviceRepository);

const deviceController = new DeviceController(registerDevice, getDevices, updateDevice);

router.use(AuthMiddleware.isAuthenticated);

router.post('/devices', AuthMiddleware.isRole(['caregiver']), (req, res) =>
    deviceController.register(req, res),
);
router.get('/patients/:patientId/devices', AuthMiddleware.isRole(['patient', 'caregiver']), (req, res) =>
    deviceController.getByPatient(req, res),
);
router.patch('/devices/:deviceId', AuthMiddleware.isRole(['caregiver']), (req, res) =>
    deviceController.update(req, res),
);

export default router;
