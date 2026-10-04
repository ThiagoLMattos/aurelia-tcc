import { AureliaInteraction } from "../entities/AureliaInteraction";

export interface AureliaRepository {
    save(interaction: AureliaInteraction): Promise<AureliaInteraction>;
}
