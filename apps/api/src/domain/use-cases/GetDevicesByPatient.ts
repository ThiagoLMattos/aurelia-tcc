import { DeviceIoT } from "../entities/DeviceIoT";
import { DeviceRepository } from "../repositories/DeviceRepository";

export class GetDevicesByPatient {
    constructor(private deviceRepository: DeviceRepository) {}

    async execute(patientId: string): Promise<DeviceIoT[]> {
        if (!patientId) {
            throw new Error('O ID do paciente é obrigatório.');
        }

        return this.deviceRepository.findByPatientId(patientId);
    }
}