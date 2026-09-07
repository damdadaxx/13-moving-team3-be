import 'express';
import { JwtPayload } from 'jsonwebtoken';
import { Role } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface AuthPayload extends JwtPayload {
      role: Role;
    }

    interface Request {
      auth?: AuthPayload;
      validatedData?: unknown;
    }
  }
}

export {};
