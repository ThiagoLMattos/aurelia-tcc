export interface DeviceIoT {
    id: string;
    patientId: string;
    model: string;
    firmwareVersion: string;
    lastSync: Date;
    status: 'Ativo' | 'Inativo' | 'Manutenção';
    lastSensorData: {
        heartRate?: number;
        bloodPressure?: string;
        movement?: string;
        batteryLevel?: number;
    };
}