import { DeviceIoT } from "../entities/DeviceIoT";

export interface DeviceRepository {
    create(device: DeviceIoT): Promise<DeviceIoT>;
    findByPatientId(patientId: string): Promise<DeviceIoT[]>;
    update(deviceId: string, data: Partial<DeviceIoT>): Promise<DeviceIoT>;
}