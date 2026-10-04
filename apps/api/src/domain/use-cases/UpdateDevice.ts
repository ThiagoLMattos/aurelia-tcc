import { DeviceIoT } from '../entities/DeviceIoT';
import { DeviceRepository } from '../repositories/DeviceRepository';

export class UpdateDevice {
    constructor(private deviceRepository: DeviceRepository) {}

    async execute(deviceId: string, data: Partial<DeviceIoT>): Promise<DeviceIoT> {
        if (!deviceId) {
            throw new Error('O ID do dispositivo é obrigatório.');
        }

        const validStatuses = ['Ativo', 'Inativo', 'Manutenção'];
        if (data.status && !validStatuses.includes(data.status)) {
            throw new Error(`Status inválido. Use: ${validStatuses.join(', ')}.`);
        }

        return this.deviceRepository.update(deviceId, {
            ...data,
            lastSync: new Date(),
        });
    }
}
