import type { Logger } from 'pino';

import type { ElderDoc } from '../repos';

declare global {
  namespace Express {
    interface AuthContext {
      uid: string;
      role: 'caregiver' | 'elder';
      /** Present only for role === 'elder'. */
      elderId?: string;
    }

    interface Request {
      auth?: AuthContext;
      log: Logger;
    }

    interface Locals {
      /** Loaded once by requireElderAccess. */
      elder?: ElderDoc;
    }
  }
}

export {};
