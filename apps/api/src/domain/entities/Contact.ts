export interface Contact {
    id: string;
    name: string;
    telephone: string;
    relation: string;
    fotoUrl?: string;
    emergency: boolean;
    priority: number;
}