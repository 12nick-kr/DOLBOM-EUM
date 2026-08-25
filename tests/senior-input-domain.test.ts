import { describe, expect, it } from 'vitest';
import { seniorInputEventSchema } from '@/lib/domain/types';

describe('senior input event contract', () => {
  it('accepts the same JSON contract for text and voice inputs', () => {
    const base = {
      schemaVersion: 1 as const,
      id: 'event-1',
      seniorId: 'senior-1',
      transcript: '병원에 같이 가 주세요.',
      category: 'service_request' as const,
      urgency: 'welfare' as const,
      summary: '병원 동행 요청',
      serviceRequestId: 'request-1',
      visibility: { family: 'summary_only' as const, worker: 'full' as const },
      confirmedAt: '2026-08-25T00:00:00.000Z',
      createdAt: '2026-08-25T00:00:00.000Z',
    };

    expect(seniorInputEventSchema.parse({ ...base, source: 'text' }).source).toBe('text');
    expect(seniorInputEventSchema.parse({ ...base, source: 'voice' }).source).toBe('voice');
  });

  it('rejects an unconfirmed or unversioned payload shape', () => {
    expect(seniorInputEventSchema.safeParse({ transcript: '도와주세요' }).success).toBe(false);
  });
});
