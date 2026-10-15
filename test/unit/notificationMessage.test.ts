import notificationMessage from '../../src/modules/notification/notificationMessage';

const { toMoveDayPlace, estimateRejected } = notificationMessage;

describe('notificationMessage.estimateRejected', () => {
  test('기사 이름과 서비스 타입으로 반려 문구를 만든다', () => {
    expect(estimateRejected('김민재', 'SMALL_MOVE')).toBe(
      '김민재 기사님이 소형이사 지정 견적 요청을 반려했어요.'
    );
  });
});

describe('notificationMessage.toMoveDayPlace', () => {
  test.each([
    ['서울특별시 영등포구 여의대로 108', '서울(영등포)'],
    ['부산광역시 해운대구 센텀로 10', '부산(해운대)'],
  ])('%s → %s', (address, expected) => {
    expect(toMoveDayPlace(address)).toBe(expected);
  });

  // 전남광주통합특별시: '전남' 패턴이 먼저 걸려 "전남(광주통합…)"으로 잘리지 않아야 한다
  test.each([
    ['전남광주통합특별시 광산구 목련로 10', '전남광주(광산)'],
    ['전남광주통합특별시 순천시 중앙로 1', '전남광주(순천)'],
  ])('통합 후 주소 %s → %s', (address, expected) => {
    expect(toMoveDayPlace(address)).toBe(expected);
  });

  // 통합 전에 저장된 주소도 같은 라벨로 보인다
  test.each([
    ['전라남도 순천시 중앙로 1', '전남광주(순천)'],
    ['광주광역시 서구 상무중앙로 10', '전남광주(서구)'],
  ])('통합 전 주소 %s → %s', (address, expected) => {
    expect(toMoveDayPlace(address)).toBe(expected);
  });
});
