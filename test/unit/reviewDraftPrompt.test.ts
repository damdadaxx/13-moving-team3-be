import { buildDraftPrompt } from '../../src/modules/review/reviewDraftPrompt';

describe('buildDraftPrompt', () => {
  // 이사일은 한국시간 자정으로 저장된다. UTC로 바꾸면 하루 앞 날짜가 들어가던 버그
  test('이사일을 한국시간 날짜로 넣는다', () => {
    const prompt = buildDraftPrompt({
      locale: 'ko',
      rating: 5,
      nickname: '김기사',
      moveDate: new Date('2026-10-07T15:00:00Z'), // 2026-10-08 00:00 KST
    });

    expect(prompt).toContain('2026-10-08');
    expect(prompt).not.toContain('2026-10-07');
  });
});
