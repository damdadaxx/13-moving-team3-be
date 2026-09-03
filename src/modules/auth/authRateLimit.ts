import rateLimit from 'express-rate-limit';

// express-rate-limit은 errorHandler를 거치지 않고 자체적으로 429를 응답한다.
const message = {
  message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
};

// 로그인 / 비밀번호 변경 — 자격 증명 브루트포스 방어
export const loginRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10, // IP당 10분에 10회
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

// 회원가입 — 대량 계정 생성 방어
export const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5, // IP당 1시간에 5회
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});
