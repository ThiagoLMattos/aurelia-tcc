export interface LLMService {
    generateResponse(prompt: string, systemContext: string): Promise<string>;
}