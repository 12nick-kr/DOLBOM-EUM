import { describe, expect, it } from 'vitest';
import { getVisibleRequest, getVisibleRequests } from '@/lib/server/serviceRequestVisibility';
import { demoFamilyId, demoSeniorId, demoWorkerId, serviceRequests } from '@/lib/server/store';

async function seedCard() {
  return serviceRequests.create({
    seniorId: demoSeniorId,
    type: 'hospital_escort',
    summary: '병원 동행이 필요해요',
    transcript: '다음 주 화요일에 병원에 같이 가 주실 수 있을까요',
    inputType: 'voice',
    details: {},
    missingFields: [],
    idempotencyKey: `visibility-${crypto.randomUUID()}`,
  });
}

describe('요청 카드 가시성 — 담당 노인 이름을 서버가 붙인다', () => {
  it('사회복지사 목록의 각 카드에 실제 노인 이름이 담긴다', async () => {
    await seedCard();
    const visible = await getVisibleRequests({ id: demoWorkerId, role: 'worker' });
    expect(visible.length).toBeGreaterThan(0);
    for (const card of visible) expect(card.seniorName).toBe('김순자');
  });

  it('가족 목록에도 같은 이름이 담긴다', async () => {
    await seedCard();
    const visible = await getVisibleRequests({ id: demoFamilyId, role: 'family' });
    expect(visible.length).toBeGreaterThan(0);
    for (const card of visible) expect(card.seniorName).toBe('김순자');
  });

  it('단건 조회도 같은 이름 정보를 반환한다', async () => {
    const created = await seedCard();
    const card = await getVisibleRequest({ id: demoWorkerId, role: 'worker' }, created.id);
    expect(card?.seniorName).toBe('김순자');
  });

  it('담당 관계가 없는 사회복지사에게는 카드가 보이지 않는다', async () => {
    await seedCard();
    const visible = await getVisibleRequests({ id: crypto.randomUUID(), role: 'worker' });
    expect(visible).toHaveLength(0);
  });

  it('노인 본인 화면에는 이름 부착이 필요 없다', async () => {
    const created = await seedCard();
    const card = await getVisibleRequest({ id: demoSeniorId, role: 'senior' }, created.id);
    expect(card?.id).toBe(created.id);
  });
});
