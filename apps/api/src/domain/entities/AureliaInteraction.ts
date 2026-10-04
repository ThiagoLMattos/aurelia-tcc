export interface AureliaInteraction {
    id: string;
    userId: string | null;
    dateTime: Date;
    prompt: string;
    response: string;
    context?: string;
}