import { DeviceIoT } from '../../domain/entities/DeviceIoT';
import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { db } from './firebase';

export class FirestoreDeviceRepository implements DeviceRepository {
    private collection = db.collection('devices');

    async create(device: DeviceIoT): Promise<DeviceIoT> {
        const docRef = this.collection.doc();
        const newDevice = { ...device, id: docRef.id };
        await docRef.set(newDevice);
        return newDevice;
    }

    async findByPatientId(patientId: string): Promise<DeviceIoT[]> {
        const snapshot = await this.collection
            .where('patientId', '==', patientId)
            .get();

        return snapshot.docs.map(doc => doc.data() as DeviceIoT);
    }

    async update(deviceId: string, data: Partial<DeviceIoT>): Promise<DeviceIoT> {
        const docRef = this.collection.doc(deviceId);
        await docRef.update(data as Record<string, any>);
        const updated = await docRef.get();
        return updated.data() as DeviceIoT;
    }
}
