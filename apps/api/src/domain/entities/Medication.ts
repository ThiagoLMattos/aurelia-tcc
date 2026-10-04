export interface MedicationDocument {
    id: string;
    patientId: string;
    name: string;
    dosage: string;
    instructions: string;
    schedule: string;
    startDate: Date;
    endDate?: Date;
    active: boolean;
}