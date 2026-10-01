import { ServiceType } from '../../generated/prisma/client';

const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  SMALL_MOVE: '소형이사',
  HOME_MOVE: '가정이사',
  OFFICE_MOVE: '사무실이사',
};

const REGION_ALIASES: [RegExp, string][] = [
  [/^서울특별시|^서울시/, '서울'],
  [/^경기도/, '경기'],
  [/^인천광역시|^인천시/, '인천'],
  [/^강원특별자치도|^강원도/, '강원'],
  [/^충청북도|^충북/, '충북'],
  [/^충청남도|^충남/, '충남'],
  [/^세종특별자치시|^세종시/, '세종'],
  [/^대전광역시|^대전시/, '대전'],
  [/^전북특별자치도|^전라북도|^전북/, '전북'],
  [/^전라남도|^전남/, '전남'],
  [/^광주광역시|^광주시/, '광주'],
  [/^경상북도|^경북/, '경북'],
  [/^경상남도|^경남/, '경남'],
  [/^대구광역시|^대구시/, '대구'],
  [/^울산광역시|^울산시/, '울산'],
  [/^부산광역시|^부산시/, '부산'],
  [/^제주특별자치도|^제주도/, '제주'],
];

const KST = 'Asia/Seoul';

/**
 * 날짜를 서울 기준 달력 날짜 문자열로 바꾸는 코드
 * - en-CA -> YYYY-MM-DD, timeZone -> 서버 UTC여도 KST 달력 날짜로 자름
 */
const toKstDateKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const notificationMessage = {
  /** 새로운 견적이 도착했어요. */
  newEstimate: (moverName: string, serviceType: ServiceType) =>
    `${moverName} 기사님의 ${SERVICE_TYPE_LABEL[serviceType]} 견적이 도착했어요.`,

  /** 새로운 견적 요청이 도착했어요. */
  newRequest: (customerName: string, serviceType: ServiceType) =>
    `${customerName}님의 ${SERVICE_TYPE_LABEL[serviceType]} 견적 요청이 도착했어요.`,

  /** 견적이 확정되었어요. */
  estimateConfirmed: (name: string, counterpart: 'mover' | 'customer') =>
    counterpart === 'mover'
      ? `${name} 기사님의 견적이 확정되었어요.`
      : `${name}님의 견적이 확정되었어요.`,

  /** 이사 예정일 알림 */
  moveDay: (relativeDay: string, departure: string, arrival: string) =>
    `${relativeDay}은 ${departure} → ${arrival} 이사 예정일이에요.`,

  /** 이사일이 오늘이면 '오늘', 내일이면 '내일', 그 외는 null */
  relativeMoveDay: (moveDate: Date, now = new Date()) => {
    const from = Date.parse(`${toKstDateKey(now)}T00:00:00Z`);
    const to = Date.parse(`${toKstDateKey(moveDate)}T00:00:00Z`);
    const days = Math.round((to - from) / 86_400_000);
    if (days === 0) return '오늘';
    if (days === 1) return '내일';
    return null;
  },

  /** '서울특별시 영등포구 …' → '서울(영등포)' */
  toMoveDayPlace: (address: string) => {
    const trimmed = address.trim();
    let region = '';
    let rest = trimmed;

    for (const [pattern, label] of REGION_ALIASES) {
      const matched = trimmed.match(pattern);
      if (!matched) continue;
      region = label;
      rest = trimmed.slice(matched[0].length).trim();
      break;
    }

    const districtToken =
      rest.match(/(\S+구)/)?.[1] ?? rest.match(/(\S+[시군])/)?.[1] ?? '';
    const northSouth = districtToken.match(/^(.+)[동서남북]구$/);
    let district = northSouth ? northSouth[1] : districtToken;
    const withoutSuffix = district.replace(/[시군구]$/, '');
    if (withoutSuffix.length >= 2) {
      district = withoutSuffix;
    }

    if (!region) return district || trimmed;
    if (!district) return region;
    return `${region}(${district})`;
  },
};

export default notificationMessage;
