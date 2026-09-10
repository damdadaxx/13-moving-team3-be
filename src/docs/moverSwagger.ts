/**
 * Mover 도메인 Swagger 문서입니다.
 *
 * 실제 요청 처리 코드는 src/modules/mover에 있으며, 이 파일에는 API 명세만
 * 작성합니다. 공통 에러 응답은 src/docs/swagger.ts의 ErrorResponse를 사용합니다.
 *
 * @openapi
 * tags:
 *   - name: Mover
 *     description: 기사님 프로필 등록·조회·수정 및 공개 기사님 조회 API
 *
 * components:
 *   schemas:
 *     MoverServiceType:
 *       type: string
 *       description: 기사님이 제공하는 이사 서비스 종류
 *       enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *       example: SMALL_MOVE
 *
 *     MoverRegion:
 *       type: string
 *       description: 기사님이 서비스를 제공할 수 있는 지역
 *       enum:
 *         - SEOUL
 *         - GYEONGGI
 *         - INCHEON
 *         - GANGWON
 *         - CHUNGBUK
 *         - CHUNGNAM
 *         - SEJONG
 *         - DAEJEON
 *         - JEONBUK
 *         - JEONNAM
 *         - GWANGJU
 *         - GYEONGBUK
 *         - GYEONGNAM
 *         - DAEGU
 *         - ULSAN
 *         - BUSAN
 *         - JEJU
 *       example: SEOUL
 *
 *     CreateMoverProfileRequest:
 *       type: object
 *       required:
 *         - nickname
 *         - careerMonths
 *         - shortIntro
 *         - description
 *         - serviceTypes
 *         - serviceRegions
 *       properties:
 *         profileImage:
 *           type: string
 *           format: binary
 *           description: 선택 항목. JPEG, PNG, WEBP 형식의 5MB 이하 이미지 한 개
 *         nickname:
 *           type: string
 *           minLength: 2
 *           maxLength: 10
 *           example: 민재 이사센터
 *         careerMonths:
 *           type: integer
 *           minimum: 0
 *           description: 기사님 경력의 총 개월 수
 *           example: 98
 *         shortIntro:
 *           type: string
 *           minLength: 8
 *           maxLength: 50
 *           example: 고객님의 물품을 안전하게 운송해 드립니다.
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 300
 *           example: 다년간의 이사 경험으로 안전하고 꼼꼼한 서비스를 제공합니다.
 *         serviceTypes:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             $ref: '#/components/schemas/MoverServiceType'
 *           example: [SMALL_MOVE, HOME_MOVE]
 *         serviceRegions:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             $ref: '#/components/schemas/MoverRegion'
 *           example: [SEOUL, GYEONGGI]
 *
 *     UpdateMoverProfileJsonRequest:
 *       type: object
 *       description: 변경할 필드만 전달합니다. 빈 객체는 허용되지 않습니다.
 *       properties:
 *         nickname:
 *           type: string
 *           minLength: 2
 *           maxLength: 10
 *           example: 민재 안심이사
 *         careerMonths:
 *           type: integer
 *           minimum: 0
 *           example: 100
 *         shortIntro:
 *           type: string
 *           minLength: 8
 *           maxLength: 50
 *           example: 안전하고 신속한 이사를 약속드립니다.
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 300
 *           example: 고객님의 소중한 물품을 끝까지 책임지고 운송합니다.
 *         serviceTypes:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             $ref: '#/components/schemas/MoverServiceType'
 *           example: [SMALL_MOVE, OFFICE_MOVE]
 *         serviceRegions:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             $ref: '#/components/schemas/MoverRegion'
 *           example: [SEOUL, INCHEON]
 *         removeImage:
 *           type: boolean
 *           description: true이면 기존 프로필 이미지를 삭제합니다.
 *           example: false
 *
 *     UpdateMoverProfileMultipartRequest:
 *       type: object
 *       description: 변경할 필드만 전달합니다. 이미지와 removeImage=true는 함께 전달할 수 없습니다.
 *       properties:
 *         profileImage:
 *           type: string
 *           format: binary
 *           description: 교체할 JPEG, PNG, WEBP 형식의 5MB 이하 이미지 한 개
 *         nickname:
 *           type: string
 *           minLength: 2
 *           maxLength: 10
 *           example: 민재 안심이사
 *         careerMonths:
 *           type: integer
 *           minimum: 0
 *           example: 100
 *         shortIntro:
 *           type: string
 *           minLength: 8
 *           maxLength: 50
 *           example: 안전하고 신속한 이사를 약속드립니다.
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 300
 *           example: 고객님의 소중한 물품을 끝까지 책임지고 운송합니다.
 *         serviceTypes:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             $ref: '#/components/schemas/MoverServiceType'
 *           example: [SMALL_MOVE, OFFICE_MOVE]
 *         serviceRegions:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             $ref: '#/components/schemas/MoverRegion'
 *           example: [SEOUL, INCHEON]
 *         removeImage:
 *           type: boolean
 *           description: true이면 기존 프로필 이미지를 삭제합니다.
 *           example: false
 *
 *     MoverProfile:
 *       type: object
 *       required:
 *         - id
 *         - imgUrl
 *         - nickname
 *         - careerMonths
 *         - shortIntro
 *         - description
 *         - serviceTypes
 *         - serviceRegions
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: 기사님 사용자 ID
 *           example: 10000000-0000-4000-8000-000000000001
 *         imgUrl:
 *           type: string
 *           nullable: true
 *           description: 프로필 이미지 URL. 이미지가 없으면 null입니다.
 *           example: /uploads/movers/550e8400-e29b-41d4-a716-446655440000.webp
 *         nickname:
 *           type: string
 *           example: 민재 이사센터
 *         careerMonths:
 *           type: integer
 *           minimum: 0
 *           description: 기사님 경력의 총 개월 수
 *           example: 98
 *         shortIntro:
 *           type: string
 *           example: 고객님의 물품을 안전하게 운송해 드립니다.
 *         description:
 *           type: string
 *           example: 다년간의 이사 경험으로 안전하고 꼼꼼한 서비스를 제공합니다.
 *         serviceTypes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MoverServiceType'
 *           example: [SMALL_MOVE, HOME_MOVE]
 *         serviceRegions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MoverRegion'
 *           example: [SEOUL, GYEONGGI]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2026-09-01T00:00:00.000Z'
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: '2026-09-09T00:00:00.000Z'
 *
 *     MoverProfileResponse:
 *       type: object
 *       required: [success, data]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/MoverProfile'
 *
 *     MoverListItem:
 *       type: object
 *       required:
 *         - id
 *         - imgUrl
 *         - nickname
 *         - careerMonths
 *         - shortIntro
 *         - serviceTypes
 *         - serviceRegions
 *         - averageRating
 *         - reviewCount
 *         - confirmedCount
 *         - likeCount
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 10000000-0000-4000-8000-000000000001
 *         imgUrl:
 *           type: string
 *           nullable: true
 *           example: https://example.com/images/mover-minjae.webp
 *         nickname:
 *           type: string
 *           example: 민재 이사센터
 *         careerMonths:
 *           type: integer
 *           minimum: 0
 *           example: 98
 *         shortIntro:
 *           type: string
 *           example: 고객님의 물품을 안전하게 운송해 드립니다.
 *         serviceTypes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MoverServiceType'
 *           example: [SMALL_MOVE, HOME_MOVE]
 *         serviceRegions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MoverRegion'
 *           example: [SEOUL, GYEONGGI]
 *         averageRating:
 *           type: number
 *           format: float
 *           minimum: 0
 *           maximum: 5
 *           description: 소수점 첫째 자리로 반올림한 평균 평점
 *           example: 4.8
 *         reviewCount:
 *           type: integer
 *           minimum: 0
 *           example: 178
 *         confirmedCount:
 *           type: integer
 *           minimum: 0
 *           description: ACCEPTED 상태인 견적 개수
 *           example: 334
 *         likeCount:
 *           type: integer
 *           minimum: 0
 *           example: 136
 *
 *     MoverListResponse:
 *       type: object
 *       required: [success, data]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           required: [list, nextCursor, totalCount]
 *           properties:
 *             list:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MoverListItem'
 *             nextCursor:
 *               type: string
 *               format: uuid
 *               nullable: true
 *               description: |
 *                 다음 페이지 요청의 cursor 쿼리에 전달할 기사님 ID입니다.
 *                 다음 페이지가 없으면 null을 반환합니다.
 *               example: 10000000-0000-4000-8000-000000000003
 *             totalCount:
 *               type: integer
 *               minimum: 0
 *               description: 검색과 필터 조건을 만족하는 전체 기사님 수
 *               example: 5
 *
 *     MoverDetail:
 *       type: object
 *       required:
 *         - id
 *         - imgUrl
 *         - nickname
 *         - careerMonths
 *         - shortIntro
 *         - description
 *         - serviceTypes
 *         - serviceRegions
 *         - averageRating
 *         - reviewCount
 *         - confirmedCount
 *         - likeCount
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 10000000-0000-4000-8000-000000000001
 *         imgUrl:
 *           type: string
 *           nullable: true
 *           example: https://example.com/images/mover-minjae.webp
 *         nickname:
 *           type: string
 *           example: 민재 이사센터
 *         careerMonths:
 *           type: integer
 *           minimum: 0
 *           example: 98
 *         shortIntro:
 *           type: string
 *           example: 고객님의 물품을 안전하게 운송해 드립니다.
 *         description:
 *           type: string
 *           example: 다년간의 이사 경험으로 안전하고 꼼꼼한 서비스를 제공합니다.
 *         serviceTypes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MoverServiceType'
 *           example: [SMALL_MOVE, HOME_MOVE]
 *         serviceRegions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MoverRegion'
 *           example: [SEOUL, GYEONGGI]
 *         averageRating:
 *           type: number
 *           format: float
 *           minimum: 0
 *           maximum: 5
 *           example: 4.8
 *         reviewCount:
 *           type: integer
 *           minimum: 0
 *           example: 178
 *         confirmedCount:
 *           type: integer
 *           minimum: 0
 *           description: ACCEPTED 상태인 견적 개수
 *           example: 334
 *         likeCount:
 *           type: integer
 *           minimum: 0
 *           example: 136
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: '2026-09-01T00:00:00.000Z'
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: '2026-09-09T00:00:00.000Z'
 *
 *     MoverDetailResponse:
 *       type: object
 *       required: [success, data]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/MoverDetail'
 */

/**
 * @openapi
 * /mover/profile:
 *   post:
 *     tags: [Mover]
 *     operationId: createMoverProfile
 *     summary: 기사님 프로필 등록
 *     description: |
 *       로그인한 MOVER 회원이 기사님 프로필을 최초 등록합니다.
 *       프로필 이미지는 선택 항목이며 JPEG, PNG, WEBP 형식의 5MB 이하 파일 한 개만 허용합니다.
 *       serviceTypes와 serviceRegions는 각각 한 개 이상의 중복되지 않은 값을 전달해야 합니다.
 *       이미 프로필을 등록한 회원이 다시 요청하면 409 응답을 반환합니다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateMoverProfileRequest'
 *           encoding:
 *             serviceTypes:
 *               style: form
 *               explode: true
 *             serviceRegions:
 *               style: form
 *               explode: true
 *     responses:
 *       201:
 *         description: 기사님 프로필 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoverProfileResponse'
 *       400:
 *         description: 요청값 검증 실패, 지원하지 않는 이미지 형식 또는 5MB 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 쿠키가 없거나 accessToken이 유효하지 않음 또는 만료됨
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 로그인한 사용자의 역할이 MOVER가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: 해당 사용자의 기사님 프로필이 이미 존재함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 예상하지 못한 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   get:
 *     tags: [Mover]
 *     operationId: getMyMoverProfile
 *     summary: 내 기사님 프로필 조회
 *     description: accessToken의 사용자 ID로 로그인한 기사님 본인의 프로필을 조회합니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 본인 기사님 프로필 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoverProfileResponse'
 *       401:
 *         description: 인증 쿠키가 없거나 accessToken이 유효하지 않음 또는 만료됨
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 로그인한 사용자의 역할이 MOVER가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 로그인한 기사님의 프로필이 존재하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 예상하지 못한 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   patch:
 *     tags: [Mover]
 *     operationId: updateMoverProfile
 *     summary: 내 기사님 프로필 수정
 *     description: |
 *       로그인한 MOVER 회원이 본인 프로필에서 전달한 필드만 수정합니다.
 *       텍스트와 배열만 수정하거나 이미지를 삭제할 때는 application/json을 사용할 수 있습니다.
 *       이미지를 교체할 때는 multipart/form-data를 사용합니다.
 *       serviceTypes 또는 serviceRegions를 전달하면 기존 목록 전체를 새 목록으로 교체합니다.
 *       profileImage와 removeImage=true를 함께 보내거나 실제 수정값 없이 요청할 수 없습니다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMoverProfileJsonRequest'
 *           examples:
 *             updateText:
 *               summary: 별명과 경력 수정
 *               value:
 *                 nickname: 민재 안심이사
 *                 careerMonths: 100
 *             updateOptions:
 *               summary: 제공 서비스와 지역 교체
 *               value:
 *                 serviceTypes: [SMALL_MOVE, OFFICE_MOVE]
 *                 serviceRegions: [SEOUL, INCHEON]
 *             removeImage:
 *               summary: 기존 프로필 이미지 삭제
 *               value:
 *                 removeImage: true
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMoverProfileMultipartRequest'
 *           encoding:
 *             serviceTypes:
 *               style: form
 *               explode: true
 *             serviceRegions:
 *               style: form
 *               explode: true
 *     responses:
 *       200:
 *         description: 기사님 프로필 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoverProfileResponse'
 *       400:
 *         description: 요청값 검증 실패, 빈 수정 요청, 이미지 처리 조건 위반 또는 업로드 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 쿠키가 없거나 accessToken이 유효하지 않음 또는 만료됨
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 로그인한 사용자의 역할이 MOVER가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 수정할 기사님 프로필이 존재하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 예상하지 못한 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /mover:
 *   get:
 *     tags: [Mover]
 *     operationId: getMovers
 *     summary: 기사님 목록 조회
 *     description: |
 *       비회원도 호출할 수 있는 공개 API입니다.
 *       기사님 별명 검색, 지역·서비스 필터, 정렬 및 커서 기반 무한 스크롤을 지원합니다.
 *
 *       첫 번째 요청에는 cursor를 전달하지 않습니다.
 *       다음 요청부터 직전 응답의 data.nextCursor를 cursor로 전달합니다.
 *       data.nextCursor가 null이면 마지막 페이지입니다.
 *
 *       필터를 초기화하려면 keyword, region, serviceType 쿼리를 보내지 않으면 됩니다.
 *       keyword, region, serviceType 또는 sortBy가 변경되면 기존 cursor를 사용하지 않고
 *       첫 페이지부터 다시 요청해야 합니다.
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: false
 *         description: 기사님 별명에 포함된 문자열을 대소문자 구분 없이 검색합니다.
 *         schema:
 *           type: string
 *           minLength: 1
 *         example: 민재
 *       - in: query
 *         name: region
 *         required: false
 *         description: 서비스 가능 지역 필터
 *         schema:
 *           $ref: '#/components/schemas/MoverRegion'
 *       - in: query
 *         name: serviceType
 *         required: false
 *         description: 제공 서비스 종류 필터
 *         schema:
 *           $ref: '#/components/schemas/MoverServiceType'
 *       - in: query
 *         name: sortBy
 *         required: false
 *         description: 정렬 기준. 모든 정렬은 높은 값부터 조회합니다.
 *         schema:
 *           type: string
 *           enum: [reviewCount, rating, career, confirmedCount]
 *           default: reviewCount
 *       - in: query
 *         name: cursor
 *         required: false
 *         description: 직전 응답의 data.nextCursor 값. 첫 페이지에서는 전달하지 않습니다.
 *         schema:
 *           type: string
 *           format: uuid
 *         example: 10000000-0000-4000-8000-000000000003
 *       - in: query
 *         name: size
 *         required: false
 *         description: 한 번에 반환할 기사님 수
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: 기사님 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoverListResponse'
 *       400:
 *         description: 검색, 필터, 정렬 또는 커서 쿼리 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 예상하지 못한 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /mover/{id}:
 *   get:
 *     tags: [Mover]
 *     operationId: getMoverById
 *     summary: 기사님 상세 조회
 *     description: |
 *       비회원도 호출할 수 있는 공개 API입니다.
 *       기사님의 프로필과 평균 평점, 리뷰 수, 확정 견적 수, 찜 수를 반환합니다.
 *       리뷰 목록과 평점 분포는 Review 도메인의 GET /reviews/mover/{id}를 사용합니다.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 조회할 기사님의 사용자 ID
 *         schema:
 *           type: string
 *           format: uuid
 *         example: 10000000-0000-4000-8000-000000000001
 *     responses:
 *       200:
 *         description: 기사님 상세 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoverDetailResponse'
 *       400:
 *         description: 기사님 ID가 UUID 형식이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 해당 ID의 기사님 프로필이 존재하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 예상하지 못한 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

export {};
