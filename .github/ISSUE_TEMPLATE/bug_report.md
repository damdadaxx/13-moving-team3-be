---
name: "🐛 버그 리포트 (Bug Report)"
about: 백엔드(API/서버) 동작 중 발견한 버그를 보고합니다.
title: "[BE][BUG] "
assignees: []
---

버그를 발견해주셔서 감사합니다! 아래 항목을 최대한 구체적으로 작성해주세요.

## 발생 환경
- [ ] Local (로컬)
- [ ] Development (개발 서버)
- [ ] Staging (스테이징)
- [ ] Production (운영)

## 관련 API 엔드포인트
<!-- 예: POST /users/login, GET /estimates/:id -->


## 재현 방법
<!-- Swagger 또는 해당 도메인의 `.http` 파일로 재현할 수 있는 단계를 순서대로 작성해주세요. -->
1. Swagger 또는 `xxx.http`에서 '...' 요청을 보낸다 (요청 payload 포함)
2. '...' 을 실행한다
3. 에러 발생

## 기대 결과
<!-- 원래 어떻게 동작해야 하나요? -->


## 실제 결과
<!-- 실제로 어떤 일이 발생했나요? (응답 status code, response body 포함) -->


## 에러 로그 / 스택 트레이스
<!-- 서버 로그, 에러 스택 트레이스, Prisma 에러 메시지 등을 붙여넣어주세요. -->
```shell

```

## DB / Prisma 관련 여부
- [ ] Prisma 쿼리 또는 마이그레이션과 관련된 이슈입니다.

## 우선순위
- [ ] 🔴 High (서비스 장애/블로킹)
- [ ] 🟡 Medium
- [ ] 🟢 Low

## 기타 참고 사항
<!-- 관련 PR, 스크린샷, 참고 링크 등 -->
