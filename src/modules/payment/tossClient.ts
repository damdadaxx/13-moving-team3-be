import { ENV } from '../../config/env';
import { ServiceUnavailableError } from '../../utils/error';

const TOSS_API = 'https://api.tosspayments.com/v1/payments';
const TIMEOUT_MS = 10_000;

/** 토스가 응답한 에러. status 가 4xx 면 승인 거절, 5xx 면 결과를 알 수 없다 */
export class TossApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'TossApiError';
    this.status = status;
    this.code = code;
  }
}

export type TossPayment = {
  paymentKey: string;
  orderId: string;
  status: string; // 승인 완료는 'DONE'
  totalAmount: number;
  approvedAt: string | null;
};

const request = async (
  url: string,
  init: RequestInit
): Promise<TossPayment> => {
  if (!ENV.TOSS_SECRET_KEY) {
    throw new ServiceUnavailableError('결제 설정이 되어 있지 않습니다.');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        // 시크릿 키 뒤에 ':' 를 붙여 Basic 인증으로 보낸다
        Authorization: `Basic ${Buffer.from(`${ENV.TOSS_SECRET_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ServiceUnavailableError(
      '결제 승인 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body ?? {}) as { code?: string; message?: string };
    throw new TossApiError(
      response.status,
      error.code ?? 'UNKNOWN',
      error.message ?? '결제 승인에 실패했습니다.'
    );
  }
  return body as TossPayment;
};

export const tossClient = {
  /** 결제 승인. orderId 를 멱등 키로 써서 같은 요청이 반복돼도 한 번만 승인된다 */
  confirm: (input: { paymentKey: string; orderId: string; amount: number }) =>
    request(`${TOSS_API}/confirm`, {
      method: 'POST',
      headers: { 'Idempotency-Key': input.orderId },
      body: JSON.stringify(input),
    }),

  getPayment: (paymentKey: string) =>
    request(`${TOSS_API}/${encodeURIComponent(paymentKey)}`, { method: 'GET' }),
};
