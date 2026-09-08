/**
 * 커스텀 에러 클래스 모음
 *
 * 사용법:
 * throw new NotFoundError();                        // 기본 메시지
 * throw new NotFoundError("유저를 찾을 수 없습니다."); // 커스텀 메시지
 *
 * 이 클래스들로 throw한 에러는 errorHandler가 instanceof AppError 분기에서
 * status와 message를 그대로 사용해 응답합니다.
 * 그 외 예상치 못한 에러(TypeError 등)는 마지막 분기에서 500으로 처리됩니다.
 *
 * isOperational은 "의도적으로 던진 예측 가능한 에러"라는 표시로 항상 true이며,
 * 현재 errorHandler는 이 값 대신 instanceof AppError로 분기합니다.
 */

/**
 * 모든 커스텀 에러의 기반 클래스
 * 직접 사용하기보다 아래 하위 클래스를 사용해 주시면 감사하겠습니다.
 */
export class AppError extends Error {
  status: number;
  isOperational: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.isOperational = true;
    this.name = 'AppError';
  }
}

/**
 * 404 - 데이터를 찾을 수 없을 때
 *  throw new NotFoundError("유저를 찾을 수 없습니다.");
 */
export class NotFoundError extends AppError {
  constructor(message = '요청한 데이터를 찾을 수 없습니다.') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 401 - 로그인이 필요하거나 인증에 실패했을 때
 *  throw new UnauthorizedError("이메일 또는 비밀번호가 올바르지 않습니다.");
 */
export class UnauthorizedError extends AppError {
  constructor(message = '인증 권한이 없습니다. 로그인 후 이용해 주세요.') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 - 로그인은 됐지만 접근 권한이 없을 때
 *  throw new ForbiddenError("관리자만 접근할 수 있습니다.");
 */
export class ForbiddenError extends AppError {
  constructor(message = '접근 권한이 없습니다.') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * 409 - 중복 데이터가 존재할 때
 *  throw new ConflictError("이미 사용 중인 이메일입니다.");
 */
export class ConflictError extends AppError {
  constructor(message = '이미 존재하는 데이터입니다.') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * 400 - 요청 데이터가 잘못됐을 때
 *  throw new BadRequestError("비밀번호가 일치하지 않습니다.");
 */
export class BadRequestError extends AppError {
  constructor(message = '잘못된 요청입니다.') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}
