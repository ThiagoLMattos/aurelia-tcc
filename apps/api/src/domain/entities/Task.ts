export interface Task {
    id?: string;
    patientId: string;
    title: string;
    description: string;
    scheduledTo: Date;
    status: 'pending' | 'completed' | 'missed';
}