export interface SOSEvent {
    id: string;
    patientId: string;
    patientName: string;
    deviceId: string;
    dateTime: Date;
    location?: {
        latitude: number;
        longitude: number;
    };
    status: 'pendente' | 'atendido' | 'encerrado';
    answeredBy?: string | null;
    observations?: string;
}