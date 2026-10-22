import jwt from 'jsonwebtoken';
import authService from '../../src/modules/auth/authService';
import authRepository from '../../src/modules/auth/authRepository';
import { ENV } from '../../src/config/env';
import { hashPassword, hashRefreshToken } from '../../src/utils/hash';
import { UnauthorizedError } from '../../src/utils/error';

jest.mock('../../src/modules/auth/authRepository');
jest.mock('../../src/utils/mailer');

const findByEmailAndRole = jest.mocked(authRepository.findByEmailAndRole);
const updateRefreshToken = jest.mocked(authRepository.updateRefreshToken);

type FoundUser = Awaited<ReturnType<typeof authRepository.findByEmailAndRole>>;
const INPUT = {
  email: 'mover@test.kr',
  password: 'test1234!',
  role: 'MOVER' as const,
};

let storedHash: string;
const user = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'mover-1',
    name: '김기사',
    email: INPUT.email,
    phoneNumber: null,
    role: 'MOVER',
    provider: 'LOCAL',
    password: storedHash,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as FoundUser;

describe('authService.login', () => {
  beforeAll(async () => {
    storedHash = await hashPassword(INPUT.password);
  });
  beforeEach(() => jest.clearAllMocks());

  // 계정 존재 여부가 드러나지 않도록 세 경우 모두 같은 401 이어야 한다
  test.each([
    ['가입하지 않은 이메일', null],
    ['소셜 가입 계정 (비밀번호 없음)', 'social'],
    ['비밀번호 불일치', 'wrong-password'],
  ])('%s → 같은 메시지의 401', async (_label, scenario) => {
    findByEmailAndRole.mockResolvedValue(
      scenario === null
        ? null
        : user(
            scenario === 'social' ? { provider: 'KAKAO', password: null } : {}
          )
    );
    const password =
      scenario === 'wrong-password' ? 'nope1234!' : INPUT.password;

    const result = authService.login({ ...INPUT, password });

    await expect(result).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(result).rejects.toThrow(
      '이메일 또는 비밀번호가 올바르지 않습니다.'
    );
    expect(updateRefreshToken).not.toHaveBeenCalled();
  });

  test('성공하면 토큰을 발급하고 refreshToken 은 해시로만 저장한다', async () => {
    findByEmailAndRole.mockResolvedValue(user());

    const result = await authService.login(INPUT);

    const payload = jwt.verify(result.accessToken, ENV.JWT_ACCESS_SECRET);
    expect(payload).toMatchObject({
      sub: 'mover-1',
      role: 'MOVER',
    });
    expect(result.user).not.toHaveProperty('password');
    expect(updateRefreshToken).toHaveBeenCalledWith(
      'mover-1',
      hashRefreshToken(result.refreshToken)
    );
  });
});
