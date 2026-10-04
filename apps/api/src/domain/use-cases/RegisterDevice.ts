import { DeviceIoT } from "../entities/DeviceIoT";
import { DeviceRepository } from "../repositories/DeviceRepository";

export class RegisterDevice {
    constructor(private deviceRepostory: DeviceRepository) {}

    async execute(data: Omit<DeviceIoT, 'id' | 'lastSync' | 'status'>): Promise<DeviceIoT> {
        if (!data.patientId || !data.model || !data.firmwareVersion) {
            throw new Error('patientId, model e firmWareVersion são obrigatórios.');
        }

        const newDevice: DeviceIoT = {
            ...data,
            id: '',
            status: 'Ativo',
            lastSync: new Date(),
            lastSensorData: data.lastSensorData ?? {},
        };

        return this.deviceRepostory.create(newDevice);
    }
}