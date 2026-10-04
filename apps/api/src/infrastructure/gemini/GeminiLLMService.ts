import { LLMService } from "../../domain/repositories/LLMService";

export class GeminiLLMService implements LLMService {

    async generateResponse(prompt: string, systemContext: string): Promise<string> {
        return `[Resposta gerada pela IA baseada no contexto: ${systemContext.slice(0, 20)}...]`;
    }
}

