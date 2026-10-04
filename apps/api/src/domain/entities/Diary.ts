export interface Diary {
    id: string;
    userId: string;
    createdAt: Date;
    content: string;
    humor: 'feliz' | 'triste' | 'neutro' | 'ansioso' | 'estressado' | 'calmo';
    visibility: 'public' | 'private';
}