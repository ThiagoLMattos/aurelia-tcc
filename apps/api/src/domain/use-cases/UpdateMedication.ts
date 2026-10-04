import { MedicationDocument } from "../entities/Medication";
import { MedicationRepository } from "../repositories/MedicationRepository";

export class UpdateMedication {
    constructor(private medicationRepository: MedicationRepository) {}

    async execute(medicationId: string, data: Partial<MedicationDocument>): Promise<MedicationDocument> {
        if (!medicationId) {
            throw new Error('O ID do medicamento é obrigatório.');
        }

        const { id, patientId, ...safeData } = data;

        return this.medicationRepository.update(medicationId, safeData);
    }
}