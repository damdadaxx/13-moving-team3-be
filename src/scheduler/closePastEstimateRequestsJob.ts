/* eslint-disable no-console -- 배치 실행 결과는 서버 로그로 남긴다. */
import { estimateRequestService } from '../modules/estimate-request/estimateRequestService';

/*=================================================
이사일 경과 견적 요청 정리 배치
=================================================*/

/*
@ 이 배치가 하는 일

- 이사일(moveDate)이 지난 견적 요청의 상태를 정리한다.
  - CONFIRMED -> COMPLETED (이사 완료)
  - PENDING   -> EXPIRED   (확정 없이 경과)
- 만료된 요청에 달린 대기 중 견적(PROPOSED/DESIGNATED)도 EXPIRED로 바꾼다.
- 고객 프로필의 활성 요청(activeEstimateRequestId) 연결을 해제한다.

@ 이 배치가 없으면 생기는 일

- 견적 요청이 PENDING/CONFIRMED에 영구히 머문다.
- 부분 유니크 인덱스 때문에 고객이 두 번째 견적 요청을 넣을 수 없다.
- 리뷰 작성(COMPLETED 요구)과 이사 이력 조회(COMPLETED/EXPIRED 조회)가 동작하지 않는다.

@ 실제 로직 위치

- estimateRequestService.closePastEstimateRequests()
- 이 파일은 호출과 로깅만 담당한다. 비즈니스 규칙을 여기에 두지 않는다.
*/

export const JOB_NAME = 'closePastEstimateRequests';

/*
@ runClosePastEstimateRequests

- 배치 본체. 스케줄러와 CLI 스크립트가 같은 함수를 호출한다.
- 호출한 쪽이 성공/실패를 판단할 수 있도록 결과를 그대로 반환한다.
- 던지는 에러는 호출한 쪽에서 처리한다. (스케줄러는 로깅, CLI는 exit code)
*/
export const runClosePastEstimateRequests = async (now?: Date) => {
  const startedAt = Date.now();
  const result = await estimateRequestService.closePastEstimateRequests(now);
  const elapsedMs = Date.now() - startedAt;

  /*
  @ 로그를 항상 남기는 이유

  - 처리 건수가 0이어도 배치가 살아 있다는 사실을 확인할 수 있어야 한다.
  - 배치가 멈춘 것과 처리할 대상이 없는 것은 로그로만 구분된다.
  */
  console.log(
    `[scheduler] ${JOB_NAME} 완료 — ` +
      `완료 ${result.completed}건, 만료 ${result.expired}건, ` +
      `만료된 견적 ${result.expiredEstimates}건 (${elapsedMs}ms)`
  );

  return result;
};
