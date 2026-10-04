import { Request, Response } from 'express';
import { CreateMedication } from '../../domain/use-cases/CreateMedication';
import { GetMedicationsByPatient } from '../../domain/use-cases/GetMedicationsByPatient';
import { UpdateMedication } from '../../domain/use-cases/UpdateMedication';

export class MedicationController {
    constructor(
        private createMedicationUseCase: CreateMedication,
        private getMedicationUseCase: GetMedicationsByPatient,
        private updateMedicationUseCase: UpdateMedication,
    ) {}

    async create(req: Request, res: Response): Promise<void> {
        try {
            const { patientId } = req.params;
            const medication = await this.createMedicationUseCase.execute({
                ...req.body,
                patientId,
            });
            res.status(201).json(medication);
        }

        catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async getByPatient(req: Request, res: Response): Promise<void> {
        try {
            const { patientId } = req.params;
            const medications = await this.getMedicationUseCase.execute(patientId);
            res.status(200).json(medications);
        }
        catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async update(req: Request, res: Response): Promise<void> {
        try {
            const { medicationId } = req.params;
            const updated = await this.updateMedicationUseCase.execute(medicationId, req.body);
            res.status(200).json(updated);
        } catch ( error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}