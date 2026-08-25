import { describe, expect, it } from 'vitest';
import { formatLoginId, internalAuthDomain, loginIdSchema, loginIdToInternalEmail, normalizeLoginId } from '@/lib/auth/credentials';

describe('phone-shaped login id credentials', () => {
  it('normalizes formatting while preserving the leading zero', () => {
    expect(normalizeLoginId('010-0000-1234')).toBe('01000001234');
    expect(formatLoginId('01000001234')).toBe('010-0000-1234');
  });

  it('accepts only the reserved non-contact demo id range', () => {
    expect(loginIdSchema.parse('010-0000-1234')).toBe('01000001234');
    expect(loginIdSchema.safeParse('010-1234-5678').success).toBe(false);
  });

  it('creates a deterministic non-routable internal auth email', () => {
    expect(loginIdToInternalEmail('010-0000-1234')).toBe(`01000001234@${internalAuthDomain}`);
  });
});
