import { describe, expect, it } from 'vitest';
import { classifyUrgency } from '@/lib/domain/urgency';
const urgent = ['가슴이 아파요', '숨이 차요', '의식이 없어요', '피가 많이 나요', '심한 출혈이에요', '죽고 싶어요', '자해하고 싶어요', '쓰러졌어요', '가슴이 조여요', '숨쉬기가 힘들어요'];
const nonUrgent = ['가슴이 아프지 않아요', '병원 예약이 있어요', '복지관 시간이 궁금해요', '오늘 기분이 좋아요', '동행이 필요해요'];
describe('emergency language regression fixtures', () => { it.each(urgent)('classifies %s as emergency', (text) => expect(classifyUrgency(text).urgency).toBe('emergency')); it.each(nonUrgent)('does not over-report %s', (text) => expect(classifyUrgency(text).urgency).not.toBe('emergency')); });
