import { Router } from 'express';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { MedicationController } from '../controllers/MedicationController';
import { FirestoreMedicationRepository } from '../../infrastructure/database/FirestoreMedicationRepository';
import { CreateMedication } from '../../domain/use-cases/CreateMedication';
import { GetMedicationsByPatient } from '../../domain/use-cases/GetMedicationsByPatient';
import { UpdateMedication } from '../../domain/use-cases/UpdateMedication';

const router = Router();

const medicationRepository = new FirestoreMedicationRepository();
const createMedication = new CreateMedication(medicationRepository);
const getMedication = new GetMedicationsByPatient(medicationRepository);
const updateMedication = new UpdateMedication(medicationRepository);

const medicationController = new MedicationController(createMedication, getMedication, updateMedication);

router.use(AuthMiddleware.isAuthenticated);

router.post('/patients/:patientId/medications', AuthMiddleware.isRole(['caregiver']), (req, res) =>
    medicationController.create(req, res),
);
router.get('/patients/:patientId/medications', AuthMiddleware.isRole(['patient', 'caregiver']), (req, res) => 
    medicationController.getByPatient(req, res),
);
router.patch('/patients/:patientId/medicationId', AuthMiddleware.isRole(['caregiver']), (req, res) => 
    medicationController.update(req, res),
);

export default router;