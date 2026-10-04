import { Diary } from '../entities/Diary';
import { DiaryRepository } from '../repositories/DiaryRepository';

export class CreateDiaryEntry {
    constructor(private diaryRepository: DiaryRepository) {}

    async execute(data: Omit<Diary, 'id' | 'createdAt'>): Promise<Diary> {
        if (!data.content || data.content.trim() === '') {
            throw new Error('O conteúdo do diário não pode estar vazio. ');
        }

        const newEntry: Diary = {
            ...data,
            createdAt: new Date(),
            id: ''
        };
        
        return this.diaryRepository.save(newEntry);
    }
    
}