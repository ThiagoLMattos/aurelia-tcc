import { User } from "../entities/User";
import { UserRepository } from "../repositories/UserRepository";

export class UpdateUser {
    constructor(private userRepository: UserRepository) {}

    async execute(
        requesterId: string,
        requesterRole: string,
        targetUid: string,
        data: Partial<Omit<User, 'uid' | 'registeredAt' | 'cpf'>>
    ): Promise<User> {
        if (requesterRole !== 'admin' && requesterId !== targetUid)  {
            throw new Error('Acesso negado: você só pode atualizar seu próprio perfil.');
        }

        if (data.role && requesterRole !== 'admin') {
            throw new Error('Apenas administradores podem alterar o perfil de acesso.');
        }

        return this.userRepository.update(targetUid, {
            ...data,
            acessedAt: new Date(),
        });
    }
}