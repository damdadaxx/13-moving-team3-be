import 'express';
import { Role } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: Role;
    }

    interface Request {
      validatedData?: unknown;
    }
  }
}

export {};
