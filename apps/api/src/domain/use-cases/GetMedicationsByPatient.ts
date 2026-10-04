import { MedicationDocument } from "../entities/Medication";
import { MedicationRepository } from "../repositories/MedicationRepository";

export class GetMedicationsByPatient {
    constructor(private medicationRepository: MedicationRepository) {}

    async execute(patientId: string): Promise<MedicationDocument[]> {
        if (!patientId) {
            throw new Error('O ID do paciente é obrigatório.');
        }

        return this.medicationRepository.findByPatientId(patientId);
    }
}