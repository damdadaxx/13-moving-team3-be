import bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'crypto';

const SALT_ROUNDS = 10;

export const hashPassword = (password: string) =>
  bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password: string, hashed: string) =>
  bcrypt.compare(password, hashed);

export const hashRefreshToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// 비밀값(시크릿, OAuth state) 비교. 해시로 길이를 맞춰 비교 시간이 값에 따라 달라지지 않게 한다.
export const isSameSecret = (value: string, expected: string) =>
  timingSafeEqual(
    createHash('sha256').update(value).digest(),
    createHash('sha256').update(expected).digest()
  );
