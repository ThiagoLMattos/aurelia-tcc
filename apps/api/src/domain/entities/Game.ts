export interface Game {
    id: string;
    name: string;
    description: string;
    category: 'Memoria' | 'Raciocínio' | 'Coordenação' | 'Relaxamento';
    dificulty: 'Fácil' | 'Médio' | 'Difícil';
    estimatedDuration: number; // in minutes
}