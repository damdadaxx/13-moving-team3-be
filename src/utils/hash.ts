import bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const SALT_ROUNDS = 10;

export const hashPassword = (password: string) =>
  bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password: string, hashed: string) =>
  bcrypt.compare(password, hashed);

export const hashRefreshToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
