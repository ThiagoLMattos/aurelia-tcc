import { MedicationDocument } from "../../domain/entities/Medication";
import { MedicationRepository } from "../../domain/repositories/MedicationRepository";
import { db } from "./firebase";

export class FirestoreMedicationRepository implements MedicationRepository {
    private collection = db.collection('medications');

    async create(medication: MedicationDocument): Promise<MedicationDocument> {
        const docRef = this.collection.doc();
        const newMedication = { ...medication, id: docRef.id };
        await docRef.set(newMedication);
        return newMedication;
    }

    async findByPatientId(patientId: string): Promise<MedicationDocument[]> {
        const snapshot = await this.collection
            .where('patientId', '==', patientId)
            .get();
        return snapshot.docs.map(doc => doc.data() as MedicationDocument);
    }

    async update(medicationId: string, data: Partial<MedicationDocument>): Promise<MedicationDocument> {
        const docRef = this.collection.doc(medicationId);
        await docRef.update(data as Record<string, any>);
        const updated = await docRef.get();
        return updated.data() as MedicationDocument;
    }
}