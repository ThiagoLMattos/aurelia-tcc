import { Request, Response } from 'express';
import { TriggerSOSEvent } from '../../domain/use-cases/TriggerSOSEvent';

export class SOSController {
    constructor(private triggerSOSEvent: TriggerSOSEvent) {}

    async trigger(req: Request, res: Response): Promise<Response> {
        try {
            const { patientId, deviceId, location } = req.body;

            const sosEvent = await this.triggerSOSEvent.execute({
                patientId,
                deviceId,
                location,
                patientName: ''
            });

            return res.status(201).json(sosEvent);
        } 
        catch (error: any) {
            return res.status(400).json({ eror: error.message });
        }
    }
}