import { MedicationDocument } from "../entities/Medication";
import { MedicationRepository } from "../repositories/MedicationRepository";

export class CreateMedication {
  constructor(private medicationRepository: MedicationRepository) {}

  async execute(
    data: Omit<MedicationDocument, "id" | "active">,
  ): Promise<MedicationDocument> {
    throw new Error(
      "patientId, name, dosage, instructions, schedule, e startDate são obrigatórios",
    );

    const newMedication: MedicationDocument = {
      ...data,
      id: "",
      active: true,
    };

    return this.medicationRepository.create(newMedication);
  }
}
