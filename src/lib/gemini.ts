import { ApiError, GoogleGenAI } from '@google/genai';
import { ENV } from '../config/env';
import { ServiceUnavailableError } from '../utils/error';

/*=================================================
Gemini 클라이언트 (리뷰 초안 · 기사님 AI 검색 공용)
=================================================*/
/*
@ 가이드
- 키는 BE 서버 env(GEMINI_API_KEY)에만 둔다. 브라우저로 내보내지 않는다
- 기능이 늘어도 클라이언트·모델·타임아웃은 여기서만 관리한다
@ 주의사항
- Gemini 한도는 키가 아니라 Google Cloud 프로젝트·모델 단위로 센다.
  사용자별 요청 제한은 middlewares/aiRateLimit.ts 가 맡는다
- Gemini 에러(401·403·429 등)를 그대로 내보내면 FE 가 401 을 세션 만료로 보고
  refresh 를 시도한다. 그래서 여기서 우리 에러(503)로 바꿔 던진다
*/
const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

export const GEMINI_TEXT_MODEL = 'gemini-3.5-flash-lite';

// 응답을 오래 기다리지 않는다. 재시도는 사용자가 다시 누르는 것으로 대신한다
const DEFAULT_TIMEOUT_MS = 20_000;

/*
@ 사용자에게 보이는 실패 문구
- 원인(쿼터 초과 · 타임아웃 · 빈 응답 · 형식 오류)과 관계없이 사용자가 할 수 있는 일은 "잠시 후 다시"뿐이라
  문구를 하나로 통일한다. 원인은 서버 로그(console.error)로만 구분한다
- FE는 이 문구 대신 자체 i18n 문구를 띄우지만, Swagger 등 다른 클라이언트에도 내부 사정이 드러나지 않게 한다
*/
const AI_UNAVAILABLE_MESSAGE =
  '지금은 AI 응답을 받을 수 없어요. 잠시 후 다시 시도해 주세요.';

interface GenerateJsonParams {
  prompt: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}

/*
@ generateJson
- 응답 형식을 JSON 스키마로 고정해 받고, 파싱한 값을 돌려준다
- 파싱 결과는 unknown 이다. 호출하는 쪽에서 zod 로 한 번 더 검증한다 (모델 출력은 신뢰하지 않는다)
*/
export const generateJson = async ({
  prompt,
  schema,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: GenerateJsonParams): Promise<unknown> => {
  let outputText: string | undefined;

  try {
    const result = await ai.interactions.create(
      {
        model: GEMINI_TEXT_MODEL,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema,
        },
      },
      { timeout: timeoutMs, maxRetries: 0 }
    );
    outputText = result.output_text;
  } catch (error: unknown) {
    // 원문(키 오류, 쿼터 상세 등)은 서버 로그에만 남긴다
    const reason =
      error instanceof ApiError && error.status === 429
        ? 'Gemini 한도 초과'
        : '요청 실패';
    console.error(`[gemini] ${reason}`, error);
    throw new ServiceUnavailableError(AI_UNAVAILABLE_MESSAGE);
  }

  if (!outputText) {
    console.error('[gemini] 빈 응답');
    throw new ServiceUnavailableError(AI_UNAVAILABLE_MESSAGE);
  }

  try {
    return JSON.parse(outputText) as unknown;
  } catch {
    console.error('[gemini] JSON 형식이 아닌 응답');
    throw new ServiceUnavailableError(AI_UNAVAILABLE_MESSAGE);
  }
};
