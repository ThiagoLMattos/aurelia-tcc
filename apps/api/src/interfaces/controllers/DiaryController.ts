import { Request, Response } from 'express';
import { CreateDiaryEntry } from '../../domain/use-cases/CreateDiaryEntry';

export class DiaryController {
    constructor(private createDiaryEntry: CreateDiaryEntry) {}

    async create(req: Request, res: Response): Promise<Response> {
        try {
            const { userId, content, humor, visibility } = req.body;

            const diaryEntry = await this.createDiaryEntry.execute({
                userId,
                content,
                humor,
                visibility
            });

            return res.status(201).json(diaryEntry);
        }

        catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}