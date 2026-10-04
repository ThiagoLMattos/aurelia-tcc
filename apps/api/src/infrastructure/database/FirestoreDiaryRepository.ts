import { db} from './firebase';
import { Diary } from '../../domain/entities/Diary';
import { DiaryRepository } from '../../domain/repositories/DiaryRepository';
import { Timestamp } from 'firebase-admin/firestore';

export class FirestoreDiaryRepository implements DiaryRepository {
    async save(diary: Diary): Promise<Diary> {
        const diaryRef = db.collection('diaries').doc();
        const id = diaryRef.id;

        const diaryData = {
            ...diary,
            id,
            createdAt: Timestamp.fromDate(diary.createdAt),
        };
        await diaryRef.set(diaryData);
        return { ...diary, id };
    }
}