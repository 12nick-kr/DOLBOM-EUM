import { describe, expect, it } from 'vitest';
import { classifyUrgency, detectSafetyRisk } from '@/lib/domain/urgency';

// PRD §20 안전 테스트: "긴급 발화 20개와 비긴급 유사 발화 20개 비교" — 재현율 100% 목표(§21).
const urgent = [
  '가슴이 아파요',
  '숨이 차요',
  '의식이 없어요',
  '피가 많이 나요',
  '심한 출혈이에요',
  '죽고 싶어요',
  '자해하고 싶어요',
  '쓰러졌어요',
  '가슴이 조여요',
  '숨쉬기가 힘들어요',
  '갑자기 가슴이 아프고 숨이 차요',
  '지금 의식이 없어요',
  '팔에서 피가 많이 나요',
  '너무 힘들어서 죽고 싶어요',
  '갑자기 쓰러졌어요',
  '가슴이 조이고 숨쉬기가 힘들어요',
  '자해를 하고 싶은 마음이 들어요',
  '숨을 쉬기가 너무 힘들어요',
  '심한 출혈이 멈추지 않아요',
  '가슴이 너무 아파서 움직일 수가 없어요',
  '살려주세요',
  '살려줘요',
  '119 불러주세요',
  '지금 119에 전화해 주세요',
  '119에 신고해줘',
];

const nonUrgent = [
  '가슴이 아프지 않아요',
  '병원 예약이 있어요',
  '복지관 시간이 궁금해요',
  '오늘 기분이 좋아요',
  '동행이 필요해요',
  '숨이 차지 않아요',
  '의식이 없지 않아요',
  '출혈이 없어요',
  '어제는 가슴이 좀 아팠는데 지금은 괜찮아요',
  '병원에 같이 가줄 사람이 필요해요',
  '다음 주에 병원 진료가 있어요',
  '오늘 산책을 다녀왔어요',
  '점심을 맛있게 먹었어요',
  '복지 서비스 신청 방법을 알고 싶어요',
  '날씨가 좋아서 기분이 좋아요',
  '어르신 안부가 궁금해요',
  '약을 다 먹었어요',
  '내일 일정이 어떻게 되나요',
  '가족과 통화했어요',
  '이번 주는 별일 없이 지냈어요',
  '병원에 같이 가줄 사람이 필요해요, 도와주세요',
  '짐 옮기는 것 좀 도와주세요',
  '119동 사람이 전화했어요',
  '119동에 사는 사람한테 전화해줘',
  '안 넘어졌어요, 그냥 산책했어요',
  '어지럽지 않아요, 오늘은 컨디션이 좋아요',
];

describe('emergency language regression fixtures (PRD §20/§21: 20 urgent + 20 non-urgent)', () => {
  it.each(urgent)('classifies %s as emergency', (text) => expect(classifyUrgency(text).urgency).toBe('emergency'));
  it.each(nonUrgent)('does not over-report %s', (text) => expect(classifyUrgency(text).urgency).not.toBe('emergency'));

  it('reaches 100% recall across all urgent fixtures (PRD §21 목표)', () => {
    const results = urgent.map((text) => classifyUrgency(text).urgency === 'emergency');
    expect(results.every(Boolean)).toBe(true);
  });

  it('produces zero false positives across all non-urgent fixtures', () => {
    const results = nonUrgent.map((text) => classifyUrgency(text).urgency === 'emergency');
    expect(results.some(Boolean)).toBe(false);
  });
});

describe('attention-level negation (부정 표현이 낙상/어지럼 오탐을 attention으로 잘못 올리지 않는지)', () => {
  it('does not flag negated fall/dizziness mentions as attention', () => {
    expect(detectSafetyRisk('안 넘어졌어요, 그냥 산책했어요').level).toBe('normal');
    expect(detectSafetyRisk('어지럽지 않아요, 오늘은 컨디션이 좋아요').level).toBe('normal');
  });

  it('still flags a genuine fall/dizziness mention as attention', () => {
    expect(detectSafetyRisk('아까 넘어졌어요').level).toBe('attention');
    expect(detectSafetyRisk('어지러워요').level).toBe('attention');
  });
});
