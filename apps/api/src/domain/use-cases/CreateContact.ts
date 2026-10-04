import { Contact } from "../entities/Contact";
import { db } from "../../infrastructure/database/firebase";
import { request } from "node:http";

export class CreateContact {
  async execute(
    requesterId: string, 
    requesterRole: string, 
    patientId: string,
    contactData: Omit<Contact, 'id'>
    ): Promise<Contact> {
        
        if (requesterRole !== 'caregiver') {
            throw new Error('Acesso negado: Apenas cuidadores podem adicionar contatos para o paciente.');
        }

        if (!contactData.name || !contactData.telephone) {
            throw new Error ('Nome e telefone são obrigatórios para registrar um contato.');
        }


        const contactRef = db.collection('users').doc(patientId).collection('contacts').doc();

        const newContact = {
            ...contactData,
            id: contactRef.id
        };

        await contactRef.set(newContact);

        return newContact;
    }
}
