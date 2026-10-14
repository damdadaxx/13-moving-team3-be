//리뷰 초안 작성 프롬프트
//프롬프트 한국어로 작성하니까 한국어로만 초안을 작성해서 각 언어별 프롬프트 작성

import { CreateDraftReviewInput } from './reviewTypes';

type DraftLocale = CreateDraftReviewInput['locale'];

const RATING_TONE: Record<DraftLocale, Record<number, string>> = {
  ko: {
    1: '매우 불만족. 짧고 단호하게, 구체적인 불만은 지어내지 말 것.',
    2: '불만족. 아쉬운 점 위주, 과장하지 말 것.',
    3: '보통. 무난했다는 뉘앙스, 과한 칭찬/비난 금지.',
    4: '만족. 친절·짐 보관 같은 일반적인 이사 경험만.',
    5: '매우 만족. 따뜻하게, 과도한 광고 문장은 피할 것.',
  },
  en: {
    1: 'very dissatisfied, brief and firm, do not invent complaints',
    2: 'dissatisfied, mild disappointment only',
    3: 'average, neither praise nor blame',
    4: 'satisfied, general moving experience only',
    5: 'very satisfied, warm but not ad-like',
  },
  zh: {
    1: '非常不满意，简短坚决，不要编造具体投诉',
    2: '不满意，只写轻微失望',
    3: '一般，不要过度称赞或批评',
    4: '满意，只写普通搬家体验',
    5: '非常满意，语气温暖但不要像广告',
  },
  ja: {
    1: '非常に不満。短く断定的に。具体的な苦情は作らない。',
    2: '不満。軽い不満だけ。',
    3: '普通。過度な称賛や非難はしない。',
    4: '満足。一般的な引越し体験だけ。',
    5: '非常に満足。温かいが宣伝文句にはしない。',
  },
};

export const buildDraftPrompt = ({
  locale,
  rating,
  nickname,
  route,
  moveDate,
}: {
  locale: DraftLocale;
  rating: number;
  nickname: string;
  route: string;
  moveDate: Date;
}) => {
  const tone = RATING_TONE[locale][rating];
  const date = moveDate.toISOString().slice(0, 10);
  const nouns = `- mover: ${nickname} - route: ${route}`;

  const prompts: Record<DraftLocale, string> = {
    ko: `이사 서비스 고객 리뷰 초안을 한국어로 작성해라.
  고유명사는 번역하지 말고 그대로 넣어라.
  ${nouns}
  평점: ${rating}점
  이사 날짜: ${date}
  말투: ${tone}
  1~3문장. 사고/파손/지각은 만들지 말 것.`,
    en: `Write a moving-service review draft in English only.
  Hangul/Chinese/Japanese is allowed only in the proper nouns below. Copy them exactly. Do not translate them.
  ${nouns}
  rating: ${rating}
  move date: ${date}
  tone: ${tone}
  1 to 3 sentences. Do not invent accidents, damage, or lateness.`,
    zh: `请只用简体中文写一篇搬家服务评价草稿。
  除以下专有名词外，禁止使用韩文或日文。专有名词必须原样复制，不要翻译。
  ${nouns}
  评分: ${rating}
  搬家日期: ${date}
  语气: ${tone}
  1到3句。不要编造事故、损坏或迟到。`,
    ja: `引越しサービスのレビュー下書きを日本語だけで書いて。
  以下の固有名詞以外にハングル・中国語を使わない。固有名詞は翻訳せずそのまま書く。
  ${nouns}
  評価: ${rating}
  引越し日: ${date}
  トーン: ${tone}
  1〜3文。事故・破損・遅刻は作らない。`,
  };

  return prompts[locale];
};
