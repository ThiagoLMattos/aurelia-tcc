import { db } from './firebase';
import { SOSEvent } from '../../domain/entities/SOSEvent';
import { SOSEventRepository } from '../../domain/repositories/SOSEventRepository';
import { Timestamp } from 'firebase-admin/firestore';

export class FirestoreSOSEventRepository implements SOSEventRepository {
    async save(event: SOSEvent): Promise<SOSEvent> {
        const sosRef = db.collection('sosEvents').doc();
        const id = sosRef.id;

        const sosData = {
            ...event,
            id,
            date_time: Timestamp.fromDate(event.dateTime)
        };

        await sosRef.set(sosData);
        return {...event, id };
    }

    async getCaregiverTokensByPatient(patientId: string): Promise<{ tokens: string[], patientName: string }> {
        const patientDoc = await db.collection('users').doc(patientId).get();

        if (!patientDoc.exists) {
            throw new Error(`Paciente com ID ${patientId} não encontrado.`);
        }

        const patientData = patientDoc.data();
        const patientName = patientData?.name || 'Paciente';
        const caregiverIds: string[] = patientData?.paciente_profile?.cuidadores_vinculados || [];
        
        if (caregiverIds.length === 0) {
            return { tokens: [], patientName};
        }

        const caregiverSnapShot = await db.collection('users')
            .where('uid', 'in', caregiverIds)
            .get();

        const tokens: string[] = [];
        caregiverSnapShot.forEach(doc => {
            const data = doc.data();
            const token = data?.configuracoes?.push_notifications_token;
            if (token) {
                tokens.push(token);
            }
        });
        return { tokens, patientName };
    }
}