import { z } from 'zod';

/*=================================================
Zod 전역 기본 에러 문구
=================================================*/
/*
@ 가이드
- 스키마에 문구를 직접 적지 않은 검증 실패에만 쓰인다. 직접 적은 문구가 항상 우선한다.
- 필드 이름을 알 수 없으므로 일반 문구만 낸다. 어느 필드인지는 응답의 fields[].field 로 구분한다.
@ 주의사항
- 사용자가 직접 입력하는 본문 필드는 이 기본값에 기대지 말고 한글 이름을 넣은 문구를 직접 적는다.
*/
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        if (issue.input === undefined) return '값을 입력해 주세요.';
        if (issue.expected === 'int') return '정수여야 합니다.';
        return '값 형식이 올바르지 않습니다.';
      case 'too_small':
        if (issue.origin === 'string') {
          return issue.minimum === 1
            ? '값을 입력해 주세요.'
            : `${issue.minimum}자 이상 입력해 주세요.`;
        }
        if (issue.origin === 'array') {
          return `${issue.minimum}개 이상 선택해 주세요.`;
        }
        return `${issue.minimum} 이상이어야 합니다.`;
      case 'too_big':
        if (issue.origin === 'string') {
          return `${issue.maximum}자 이하로 입력해 주세요.`;
        }
        if (issue.origin === 'array') {
          return `${issue.maximum}개 이하로 선택해 주세요.`;
        }
        return `${issue.maximum} 이하여야 합니다.`;
      case 'invalid_format':
        return '값 형식이 올바르지 않습니다.';
      default:
        return '값이 올바르지 않습니다.';
    }
  },
});
