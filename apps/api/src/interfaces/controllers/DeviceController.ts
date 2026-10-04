import { Request, Response } from 'express';
import { RegisterDevice } from '../../domain/use-cases/RegisterDevice';
import { GetDevicesByPatient } from '../../domain/use-cases/GetDevicesByPatient';
import { UpdateDevice } from '../../domain/use-cases/UpdateDevice';

export class DeviceController {
    constructor(
        private registerDeviceUseCase: RegisterDevice,
        private getDevicesUseCase: GetDevicesByPatient,
        private updateDeviceUseCase: UpdateDevice,
    ) {}

    async register(req: Request, res: Response): Promise<void> {
        try {
            const device = await this.registerDeviceUseCase.execute(req.body);
            res.status(201).json(device);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async getByPatient(req: Request, res: Response): Promise<void> {
        try {
            const { patientId } = req.params;
            const devices = await this.getDevicesUseCase.execute(patientId);
            res.status(200).json(devices);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async update(req: Request, res: Response): Promise<void> {
        try {
            const { deviceId } = req.params;
            const updated = await this.updateDeviceUseCase.execute(deviceId, req.body);
            res.status(200).json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}
