import { User } from "../../domain/entities/User";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { db } from "./firebase";

export class FirestoreUserRepository implements UserRepository {
    private collection = db.collection('users');

    async create(user: User): Promise<User> {
        await this.collection.doc(user.uid).set(user);
        return user;
    }

    async findById(uid: string): Promise<User | null> {
        const doc = await this.collection.doc(uid).get();

        if (!doc.exists) return null;

        return doc.data() as User;
    }

    async update(uid: string, data: Partial<User>): Promise<User> {
        const docRef = this.collection.doc(uid);

        await docRef.update(data as Record<string, any>);

        const updated = await docRef.get();
        return updated.data() as User;
    }
}