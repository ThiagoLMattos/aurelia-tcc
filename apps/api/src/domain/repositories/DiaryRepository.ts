import { Diary } from '../entities/Diary';

export interface DiaryRepository {
    save(diary: Diary): Promise<Diary>;
}