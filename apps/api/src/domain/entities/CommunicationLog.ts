export interface CommunicationLog {
    id?: string;
    patientId: string;
    contactId: string;
    contactName: string;
    communicationType: 'Ligacao' | 'Mensagem';
    dateHour: Date;
}