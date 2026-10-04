import { User } from '../entities/User';

export interface UserRepository {
    create(user: User): Promise<User>;
    findById(uid: string): Promise<User | null>;
    update(uid: string, data: Partial<User>): Promise<User>;
}