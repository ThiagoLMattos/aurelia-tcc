import { SOSEvent } from "../entities/SOSEvent";

export interface SOSEventRepository {
    save(event: SOSEvent): Promise<SOSEvent>;
    getCaregiverTokensByPatient(patientId: string): Promise<{ tokens: string[], patientName: string }>;
}
