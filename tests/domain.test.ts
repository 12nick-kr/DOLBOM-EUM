import { describe, expect, it } from 'vitest';
import { validateDocument, secureObjectPath } from '@/lib/domain/documents';
import { canTransitionRequest, canViewSenior, needsConfirmation } from '@/lib/domain/policies';
import { classifyUrgency } from '@/lib/domain/urgency';
describe('risk and permission policies', () => {
  it('detects an emergency but recognizes a negated similar phrase', () => { expect(classifyUrgency('가슴이 조이고 숨이 차요').urgency).toBe('emergency'); expect(classifyUrgency('가슴이 아프지 않아').urgency).not.toBe('emergency'); });
  it('allows only active consent-based access', () => { expect(canViewSenior('family', true, true)).toBe(true); expect(canViewSenior('family', true, false)).toBe(false); expect(canViewSenior('worker', false, true)).toBe(false); });
  it('allows only defined request state transitions and confirmation tokens', () => { expect(canTransitionRequest('new', 'in_progress')).toBe(true); expect(canTransitionRequest('done', 'new')).toBe(false); expect(needsConfirmation()).toBe(true); expect(needsConfirmation('confirmed')).toBe(false); });
});
describe('private document contract', () => {
  it('blocks unsuitable type, spoofed magic bytes and too-large files', () => { expect(validateDocument({ type: 'text/plain', size: 4, bytes: new Uint8Array([1]) }).valid).toBe(false); expect(validateDocument({ type: 'application/pdf', size: 4, bytes: new Uint8Array([1, 2, 3, 4]) }).valid).toBe(false); expect(validateDocument({ type: 'image/png', size: 6 * 1024 * 1024, bytes: new Uint8Array([137, 80, 78, 71]) }).valid).toBe(false); });
  it('creates a UUID-only storage path without PII', () => expect(secureObjectPath('senior-uuid', 'document-uuid', 'pdf')).toBe('senior-uuid/document-uuid/original.pdf'));
});
