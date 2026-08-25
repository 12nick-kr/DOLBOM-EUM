import { describe, expect, it } from 'vitest';
import { InMemorySeniorInputRepository } from '@/lib/server/seniorInputRepository';

describe('InMemorySeniorInputRepository', () => {
  it('deduplicates confirmed inputs by senior and idempotency key', async () => {
    const repository = new InMemorySeniorInputRepository();
    const input = {
      seniorId: 'senior-1',
      source: 'text' as const,
      transcript: '병원 동행이 필요해요.',
      category: 'service_request' as const,
      urgency: 'welfare' as const,
      summary: '병원 동행 요청',
      visibility: { family: 'summary_only' as const, worker: 'full' as const },
      idempotencyKey: 'same-confirmation',
    };

    const first = await repository.create(input);
    const second = await repository.create(input);

    expect(second.id).toBe(first.id);
    expect(await repository.listForSenior('senior-1')).toHaveLength(1);
  });

  it('links the persisted input event to its generated request card', async () => {
    const repository = new InMemorySeniorInputRepository();
    const event = await repository.create({
      seniorId: 'senior-1', source: 'voice', transcript: '내일 병원에 같이 가 주세요.',
      category: 'service_request', urgency: 'welfare', summary: '병원 동행 요청',
      visibility: { family: 'summary_only', worker: 'full' }, idempotencyKey: 'event-link',
    });
    const linked = await repository.attachServiceRequest(event.id, 'request-1');
    expect(linked.serviceRequestId).toBe('request-1');
  });
});
