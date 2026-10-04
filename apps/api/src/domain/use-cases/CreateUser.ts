import { User } from '../entities/User';
import { UserRepository } from '../repositories/UserRepository';

export class CreateUser {
    constructor(private UserRepository: UserRepository) {}
    
    async execute(uid: string, data: Omit<User, 'uid' | 'registeredAt' | acessedAt>): Promise<User> {
        if(!data.name || !data.email || !data.cpf || !data.role) {
            throw new Error('Nome, e-mail, CPF e perfil são obrigatórios.');
        }

        if (!['patient', 'caregiver', 'admin'].includes(data.role)) {
            throw new Error('Perfil inválido. Use: patient, caregiver ou admin.');

        }

        const newUser: User = {
            ...data,
            uid,
            registeredAt: new Date(),
            acessedAt: new Date(),
        };

        return this.UserRepository.create(newUser);
    }
}