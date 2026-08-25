import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FamilyDashboard } from '@/components/FamilyDashboard';

describe('FamilyDashboard — emergency acknowledgement leaves an audit trail (Phase 5, FR-03)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('calls the real emergencies API (not only local state) when the family confirms an emergency', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'emergency-demo-001', status: 'family_acknowledged' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<FamilyDashboard />);
    fireEvent.click(screen.getByText('가슴 통증과 호흡 곤란 표현이 감지되었어요'));
    fireEvent.click(screen.getByRole('button', { name: '확인 완료' }));
    await Promise.resolve();
    await Promise.resolve();
    const patchCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/emergencies/'));
    expect(patchCall).toBeDefined();
    expect(patchCall![1].method).toBe('PATCH');
    const body = JSON.parse(patchCall![1].body);
    expect(body.actor).toBe('family');
    expect(body.status).toBe('family_acknowledged');
  });

  it('never displays text claiming an actual 119 report was completed', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<FamilyDashboard />);
    fireEvent.click(screen.getByText('가슴 통증과 호흡 곤란 표현이 감지되었어요'));
    expect(screen.queryByText(/신고\s*완료/)).toBeNull();
  });
});
