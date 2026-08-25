import { describe, expect, it } from 'vitest';
import { canViewSenior, needsConfirmation, redactForRole } from '@/lib/domain/policies';
import { InMemoryServiceRequestRepository } from '@/lib/server/serviceRequestRepository';
import type { RequestStatus } from '@/lib/domain/types';

describe('relationship and consent based access (PRD §6, §16)', () => {
  it('denies a family member with no active care relationship', () => {
    expect(canViewSenior('family', false, true)).toBe(false);
  });
  it('denies a family member whose consent has expired or been revoked even with an active relationship', () => {
    expect(canViewSenior('family', true, false)).toBe(false);
  });
  it('allows a senior to view their own record regardless of relationship rows', () => {
    expect(canViewSenior('senior', false, false)).toBe(true);
  });
  it('allows a worker only with both an active relationship and active consent', () => {
    expect(canViewSenior('worker', true, true)).toBe(true);
    expect(canViewSenior('worker', true, false)).toBe(false);
  });
});

describe('transcript redaction for family without transcript consent (PRD §7.4)', () => {
  const card = { id: 'r1', seniorId: 's1', type: 'hospital_escort' as const, summary: '요약', transcript: '원문 발화 내용', inputType: 'voice' as const, details: {}, missingFields: [], status: 'new' as const, assigneeId: null, acknowledgedAt: null, createdAt: 'x', updatedAt: 'x' };

  it('strips transcript for family role without explicit transcript consent', () => {
    const redacted = redactForRole(card, 'family', { transcriptConsent: false });
    expect(redacted.transcript).toBeUndefined();
    expect(redacted.summary).toBe('요약');
  });
  it('keeps transcript for the senior themself', () => {
    const redacted = redactForRole(card, 'senior', { transcriptConsent: false });
    expect(redacted.transcript).toBe('원문 발화 내용');
  });
  it('keeps transcript for the assigned worker', () => {
    const redacted = redactForRole(card, 'worker', { transcriptConsent: false });
    expect(redacted.transcript).toBe('원문 발화 내용');
  });
  it('keeps transcript for family only when transcript consent is explicitly granted', () => {
    const redacted = redactForRole(card, 'family', { transcriptConsent: true });
    expect(redacted.transcript).toBe('원문 발화 내용');
  });
});

describe('high-risk tool confirmation gate', () => {
  it('rejects execution without an explicit confirmation token', () => {
    expect(needsConfirmation()).toBe(true);
    expect(needsConfirmation(undefined)).toBe(true);
    expect(needsConfirmation('')).toBe(true);
  });
  it('allows execution only with the confirmed token', () => {
    expect(needsConfirmation('confirmed')).toBe(false);
  });
});

describe('in-memory service request repository (idempotency + draft exclusion)', () => {
  it('creates a new card from a confirmed draft and assigns server-generated fields', async () => {
    const repo = new InMemoryServiceRequestRepository();
    const created = await repo.create({
      seniorId: 'senior-1', type: 'hospital_escort', summary: '요약', transcript: '원문', inputType: 'voice',
      details: { destination: '충남대학교병원' }, missingFields: [], idempotencyKey: 'key-1',
    });
    expect(created.status).toBe('new');
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();
  });

  it('does not create a duplicate card when the same idempotency key is resent', async () => {
    const repo = new InMemoryServiceRequestRepository();
    const first = await repo.create({ seniorId: 'senior-1', type: 'welfare_info', summary: 's', transcript: 't', inputType: 'text', details: {}, missingFields: [], idempotencyKey: 'dup-key' });
    const second = await repo.create({ seniorId: 'senior-1', type: 'welfare_info', summary: 's', transcript: 't', inputType: 'text', details: {}, missingFields: [], idempotencyKey: 'dup-key' });
    expect(second.id).toBe(first.id);
    expect((await repo.list()).filter((r) => r.id === first.id)).toHaveLength(1);
  });

  it('never lists a draft — draft is client-only and never persisted', async () => {
    const repo = new InMemoryServiceRequestRepository();
    await repo.create({ seniorId: 'senior-1', type: 'daily_help', summary: 's', transcript: 't', inputType: 'text', details: {}, missingFields: [], idempotencyKey: 'k2' });
    expect((await repo.list()).every((r) => (r.status as RequestStatus) !== 'draft')).toBe(true);
  });

  it('rejects a disallowed transition and does not mutate the card', async () => {
    const repo = new InMemoryServiceRequestRepository();
    const created = await repo.create({ seniorId: 'senior-1', type: 'hospital_escort', summary: 's', transcript: 't', inputType: 'voice', details: {}, missingFields: [], idempotencyKey: 'k3' });
    await expect(repo.transition(created.id, 'done')).rejects.toThrow();
    const stillNew = (await repo.list()).find((r) => r.id === created.id);
    expect(stillNew?.status).toBe('new');
  });

  it('rejects the senior cancelling a card once it is in_progress', async () => {
    const repo = new InMemoryServiceRequestRepository();
    const created = await repo.create({ seniorId: 'senior-1', type: 'hospital_escort', summary: 's', transcript: 't', inputType: 'voice', details: {}, missingFields: [], idempotencyKey: 'k4' });
    await repo.transition(created.id, 'in_progress');
    await expect(repo.cancel(created.id, 'senior')).rejects.toThrow();
  });
});
