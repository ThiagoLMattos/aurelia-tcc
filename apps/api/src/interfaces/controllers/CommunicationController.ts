import { Request, Response } from "express";
import { LogCommunication } from "../../domain/use-cases/CommunicationLog";

export class CommunicationController {
    constructor(private logCommunication: LogCommunication) {}
    
    async log(req: Request, res: Response): Promise<Response> {
        try {
            const { patientId, contactId, contactName, communicationType } = req.body;

            const log = await this.logCommunication.execute({
                patientId, 
                contactId,
                contactName,
                communicationType
            });

            return res.status(201).json(log);
        }
        catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}
