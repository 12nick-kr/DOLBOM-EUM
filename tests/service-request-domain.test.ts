import { describe, expect, it } from 'vitest';
import { canCancelRequest, canTransitionRequest, statusLabelFor } from '@/lib/domain/policies';
import { serviceRequestSchema } from '@/lib/domain/types';

describe('request card status transitions (PRD §7.4)', () => {
  it('allows the confirmation transition from draft to new', () => {
    expect(canTransitionRequest('draft', 'new')).toBe(true);
  });
  it('allows a worker to move a new card to in_progress', () => {
    expect(canTransitionRequest('new', 'in_progress')).toBe(true);
  });
  it('allows in_progress to resolve to done or rejected', () => {
    expect(canTransitionRequest('in_progress', 'done')).toBe(true);
    expect(canTransitionRequest('in_progress', 'rejected')).toBe(true);
  });
  it('allows new to be rejected directly', () => {
    expect(canTransitionRequest('new', 'rejected')).toBe(true);
  });
  it('rejects any transition out of a terminal state', () => {
    expect(canTransitionRequest('done', 'in_progress')).toBe(false);
    expect(canTransitionRequest('rejected', 'new')).toBe(false);
  });
  it('rejects skipping states (new directly to done)', () => {
    expect(canTransitionRequest('new', 'done')).toBe(false);
  });
  it('rejects moving backwards from in_progress to new', () => {
    expect(canTransitionRequest('in_progress', 'new')).toBe(false);
  });
  it('never allows re-entering draft from any server state', () => {
    expect(canTransitionRequest('new', 'draft')).toBe(false);
    expect(canTransitionRequest('in_progress', 'draft')).toBe(false);
  });
});

describe('senior cancellation rights (PRD §7.4)', () => {
  it('allows the senior to cancel while the card is still new', () => {
    expect(canCancelRequest('senior', 'new')).toBe(true);
  });
  it('rejects the senior cancelling once a worker has taken it in_progress', () => {
    expect(canCancelRequest('senior', 'in_progress')).toBe(false);
  });
  it('rejects the senior cancelling a done or rejected card', () => {
    expect(canCancelRequest('senior', 'done')).toBe(false);
    expect(canCancelRequest('senior', 'rejected')).toBe(false);
  });
});

describe('role-specific status phrasing (PRD §7.4 table)', () => {
  it('renders senior-friendly copy without administrative terms', () => {
    expect(statusLabelFor('senior', 'new')).toBe('담당자에게 보냈어요');
    expect(statusLabelFor('senior', 'in_progress')).toBe('담당자가 확인 중이에요');
    expect(statusLabelFor('senior', 'done')).toBe('도움이 연결됐어요');
    expect(statusLabelFor('senior', 'rejected')).toBe('담당자가 다시 연락드릴 거예요');
  });
  it('renders family-facing copy', () => {
    expect(statusLabelFor('family', 'new')).toBe('접수됨');
    expect(statusLabelFor('family', 'in_progress')).toBe('처리 중');
    expect(statusLabelFor('family', 'done')).toBe('완료');
    expect(statusLabelFor('family', 'rejected')).toBe('확인 필요');
  });
  it('renders worker-facing copy', () => {
    expect(statusLabelFor('worker', 'new')).toBe('신규');
    expect(statusLabelFor('worker', 'in_progress')).toBe('진행중');
    expect(statusLabelFor('worker', 'done')).toBe('완료');
    expect(statusLabelFor('worker', 'rejected')).toBe('반려');
  });
});

describe('service request card schema (PRD §7.4 fields)', () => {
  it('accepts a fully-formed new card with all PRD-required fields', () => {
    const parsed = serviceRequestSchema.safeParse({
      id: 'request-1',
      seniorId: 'senior-1',
      type: 'hospital_escort',
      summary: 'AI가 만든 한 문장 요약',
      transcript: '다음 주 화요일 병원 갈 때 같이 갈 사람이 필요해요.',
      inputType: 'voice',
      details: { destination: '충남대학교병원', desiredAt: '2026-09-01T10:00:00+09:00', needsTransportHelp: true },
      missingFields: [],
      status: 'new',
      assigneeId: null,
      acknowledgedAt: null,
      createdAt: '2026-08-25T10:00:00+09:00',
      updatedAt: '2026-08-25T10:00:00+09:00',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects draft as a persisted status value (draft is client-only)', () => {
    const parsed = serviceRequestSchema.safeParse({
      id: 'request-1', seniorId: 'senior-1', type: 'hospital_escort', summary: 's', transcript: 't', inputType: 'text', details: {}, missingFields: [], status: 'draft', assigneeId: null, acknowledgedAt: null, createdAt: 'x', updatedAt: 'x',
    });
    expect(parsed.success).toBe(false);
  });
});
