import type { Firestore } from 'firebase-admin/firestore';

import { createEldersRepo, type EldersRepo } from './elders';
import { createUsersRepo, type UsersRepo } from './users';

export interface Repos {
  users: UsersRepo;
  elders: EldersRepo;
}

export const createRepos = (db: Firestore): Repos => ({
  users: createUsersRepo(db),
  elders: createEldersRepo(db),
});

export type { ElderDoc } from './elders';
export type { UserDoc } from './users';
