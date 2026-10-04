import { CommunicationLog } from "../entities/CommunicationLog";
import { db } from "../../infrastructure/database/firebase";
import { Timestamp } from "firebase-admin/firestore";

export class LogCommunication {
    async execute(data: Omit<CommunicationLog, 'id' | 'dateHour'>): Promise<CommunicationLog> {
        
        const logRef = db.collection('communication_logs').doc();

        const newLog = {
            ...data,
            id: logRef.id,
            dateHour: Timestamp.now()
        };

        await logRef.set(newLog);

        return { ...newLog, dateHour: new Date() };
    }
}
