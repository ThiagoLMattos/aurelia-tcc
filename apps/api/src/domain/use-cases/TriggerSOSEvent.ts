import { SOSEvent } from '../entities/SOSEvent';
import { SOSEventRepository } from '../repositories/SOSEventRepository';
import { getMessaging } from 'firebase-admin/messaging';

export class TriggerSOSEvent {
    constructor(private sosEventRepository: SOSEventRepository) {}

    async execute(data: Omit<SOSEvent, 'id' | 'dateTime' | 'status'>): Promise<SOSEvent> {
        const newEvent: SOSEvent = {
            ...data,
            dateTime: new Date(),
            status: 'pendente',
            id: ''
        };

        const savedEvent = await this.sosEventRepository.save(newEvent);

        const { tokens, patientName } = await this.sosEventRepository.getCaregiverTokensByPatient(data.patientId);

        if (tokens.length > 0) {
            const message = {
                tokens: tokens,
                notification: {
                    title: 'ALERTA SOS - AURÉLIA',
                    body: `${patientName} apertou o botão de emergência!`
                },

                android: {
                    priority: 'high' as const,
                    notification: { sound: 'default', channelId: 'emergency_channel'}
                },

                data: {
                    type: 'SOS_TRIGGERED',
                    patient_id: data.patientId,
                    latitude: String(data.location?.latitude),
                    longitude: String(data.location?.longitude)
                }
            };

            try {
                await getMessaging().sendEachForMulticast(message);
            }
            catch (fcmError) {
                console.error('Falha ao enviar push notification, log de SOS salvo:', fcmError);
            }
        }

        return savedEvent;
    }
}