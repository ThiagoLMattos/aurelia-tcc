import { MedicationDocument } from '../entities/Medication';

export interface MedicationRepository {
    create(medication: MedicationDocument): Promise<MedicationDocument>;
    findByPatientId(patientId: string): Promise<MedicationDocument[]>;
    update(medicationId: string, data: Partial<MedicationDocument>): Promise<MedicationDocument>
}