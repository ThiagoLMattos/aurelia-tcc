export interface CaregiverReport {
    patientId: string;
    periodo: { 
        start: Date; 
        end: Date
    }
    rateMedicationAdherence: number;
    primaryHumor: string;
    eventSOSTotal: number;
    averageGameScore: number;
}