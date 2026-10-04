import { CaregiverReport } from "../entities/CaregiverReport";
import { db } from '../../infrastructure/database/firebase';
import { Timestamp } from "firebase-admin/firestore";

export class GeneratePatientReport {
    async execute(patientId: string, diasAnalise: number = 7): Promise<CaregiverReport> {
        const endDate = new Date();
        const startDate = new Date();

        startDate.setDate(startDate.getDate() - diasAnalise);

        const startTs = Timestamp.fromDate(startDate);
        const endTs = Timestamp.fromDate(endDate);

        const [tasksSnapshot, diariesSnapshot, sosSnapshot, gamesSnapshot] = await Promise.all([
            db.collection('tasks')
                .where('patientId', '==', patientId)
                .where('categoria', '==', 'Medicamento')
                .where('dateTime', '>=', startTs)
                .where('dateTime', '<=', endTs)
                .get(),

            db.collection('diaries')
                .where('userId', '==', patientId)
                .where('createdAt', '>=', startTs)
                .get(),

            db.collection('sos_events')
                .where('patientId', '==', patientId)
                .where('dateTime', '>=', startTs)
                .get(),

            db.collection('game_sessions')
                .where('patientId', '==', patientId)
                .where('startTime', '>=', startTs)
                .get()
        ]);


        let totalMedication = tasksSnapshot.size;
        let tomados = 0;
        tasksSnapshot.forEach(doc => {
            if (doc.data().status === 'Concluida') tomados++;
        });
        const rateAccess = totalMedication === 0 
        ? 100 
        : Math.round((tomados / totalMedication) * 100);



        const eventSOSTotal = sosSnapshot.size;
        


        const humors: Record<string, number> = {};
        diariesSnapshot.forEach(doc => {
            const humor = doc.data().humor;
            humors[humor] = (humors[humor] || 0) + 1;
        });

        const primaryHumor = Object.keys(humors).reduce((a, b) => {
            const countA = humors[a] || 0;
            const countB = humors[b] || 0;

            return countA > countB ? a : b;
        }, 'Sem registros');


        let sumScore = 0;
        gamesSnapshot.forEach(doc => sumScore += (doc.data().score || 0));
        
        const averageGame = gamesSnapshot.size === 0
        ? 0
        : Math.round(sumScore / gamesSnapshot.size);

        return {
            patientId,
            periodo: {
                start: startDate, 
                end: endDate
            },
            rateMedicationAdherence: rateAccess,
            primaryHumor,
            eventSOSTotal,
            averageGameScore: averageGame
        };
    }
}
