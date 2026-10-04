import { Request, Response } from 'express';
import { CreateContact } from '../../domain/use-cases/CreateContact.ts';

export class ContactController {
    constructor(private createContact: CreateContact) {}

    async create(req: Request, res: Response): Promise<Response> {
        try {
            const patientId = String(req.params.patientId);
        
            const { requesterId, requesterRole, name, telephone, relation, emergency, priority, fotoUrl } = req.body;


            const contact = await this.createContact.execute(
                requesterId,
                requesterRole,
                patientId,
                { name, telephone, relation, emergency, priority, fotoUrl }
            );

            return res.status(201).json(contact);
        }
        catch (error: any) {
            return res.status(403).json({ error: error.mesage });
        }
    }
}