export interface GameSession {
    id: string;
    patientId: string;
    gameId: string;
    gaameName: string;
    startTime: Date;
    endTime: Date;
    score: number;
    metricas?: string;
}