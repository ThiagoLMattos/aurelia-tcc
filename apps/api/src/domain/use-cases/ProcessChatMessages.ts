import { AureliaInteraction } from "../entities/AureliaInteraction";
import { AureliaRepository } from "../repositories/AureliaRepository";
import { LLMService } from "../repositories/LLMService";

export class ProcessChatMessage {
    constructor(
        private interactionRepo: AureliaRepository,
        private llmService: LLMService,
        private userProfileRepo: any
    ) {}

    async execute(userId: string, prompt: string): Promise<AureliaInteraction> {
        const patientInfo = await this.userProfileRepo.getPatientById(userId);

        const systemContext = `
        Você é a Aurélia, uma assistente virtual carinhosa para idosos.
        Nome do paciente: ${patientInfo.name}.
        Diagnóstico: ${patientInfo.diagnostico} (Nível Cognitivo: ${patientInfo.nivel}).
        Regra: Responda de forma extremamaente curta, simples, direta e afetuosa. Não use jargões.`;

        const resIA = await this.llmService.generateResponse(prompt, systemContext);

        const interacao: AureliaInteraction = {
            userId,
            dateTime: new Date(),
            prompt,
            response: resIA,
            context: `Nível: ${patientInfo.nivel}`,
            id: ""
        };

        return this.interactionRepo.save(interacao);
    }
}
