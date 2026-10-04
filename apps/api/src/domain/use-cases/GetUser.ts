import { User } from "../entities/User";
import { UserRepository } from "../repositories/UserRepository";

export class GetUser {
    constructor(private userRepository: UserRepository) {}

    async execute(uid: string): Promise<User> {
        const user = await this.userRepository.findById(uid);

        if (!user) {
            throw new Error('Usuário não encontrado.');
        }

        return user;
    }
}