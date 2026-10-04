import { Router } from "express";
import { ReportController } from "../controllers/ReportController";
import { GeneratePatientReport } from "../../domain/use-cases/GeneratePatientReport";
const router = Router();

const reportUseCase = new GeneratePatientReport();
const reportController = new ReportController(reportUseCase);

router.get('/reports/patient/:patientId', (req, res) => reportController.getReport(req, res));

export default router;
