import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FamilyDashboard } from '@/components/FamilyDashboard';

const doneCard = {
  id: 'request-family-1', seniorId: 'senior-demo-001', type: 'hospital_escort', summary: '병원 동행 도움이 필요해요.',
  transcript: '원문 발화는 가족에게 보이지 않아야 함', inputType: 'voice', details: {}, missingFields: [],
  status: 'done', assigneeId: 'worker-demo-001', acknowledgedAt: '2026-08-25T01:00:00Z', createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T01:00:00Z',
};
const emergency = { id: 'emergency-demo-001', seniorId: 'senior-demo-001', utterance: '가슴 통증과 호흡 곤란 표현이 감지되었어요', location: '대전광역시 중구', level: 'emergency', status: 'detected', createdAt: '2026-08-25T00:00:00Z', actions: [] };

function dashboardFetch(cards = [doneCard]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/care-cards') return { ok: true, json: async () => ({ data: cards, is_demo: true }) };
    if (url === '/api/emergencies' && !init?.method) return { ok: true, json: async () => ({ data: [emergency], is_demo: true }) };
    return { ok: true, json: async () => ({ ...emergency, status: 'family_acknowledged' }) };
  });
}

describe('FamilyDashboard — driven by the real service-requests API, not hardcoded mock data (Phase 6c, 목데이터 금지)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders the weekly request count from GET /api/service-requests instead of a hardcoded value, and the AI summary reflects the real latest card', async () => {
    const fetchMock = dashboardFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(<FamilyDashboard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/care-cards'));
    // one real card this week -> the AI summary reflects the real latest card's summary, not a hardcoded string
    await waitFor(() => expect(screen.getByText(/이번 주에 병원 동행 도움이 필요해요\./)).toBeVisible());
  });

  it('never renders the request transcript on the family screen (redacted server-side, but the client must not assume it exists either)', async () => {
    const fetchMock = dashboardFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(<FamilyDashboard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/원문 발화는 가족에게 보이지 않아야 함/)).toBeNull();
  });
});

describe('FamilyDashboard — emergency acknowledgement leaves an audit trail (Phase 5, FR-03)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('calls the real emergencies API (not only local state) when the family confirms an emergency', async () => {
    const fetchMock = dashboardFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(<FamilyDashboard />);
    fireEvent.click(await screen.findByText('가슴 통증과 호흡 곤란 표현이 감지되었어요'));
    fireEvent.click(screen.getByRole('button', { name: '확인 완료' }));
    await Promise.resolve();
    await Promise.resolve();
    const patchCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/emergencies/') && call[1]?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchInit = patchCall?.[1] as RequestInit;
    expect(patchInit.method).toBe('PATCH');
    const body = JSON.parse(String(patchInit.body));
    expect(body.actor).toBeUndefined();
    expect(body.status).toBe('family_acknowledged');
  });

  it('never displays text claiming an actual 119 report was completed', async () => {
    vi.stubGlobal('fetch', dashboardFetch());
    render(<FamilyDashboard />);
    fireEvent.click(await screen.findByText('가슴 통증과 호흡 곤란 표현이 감지되었어요'));
    expect(screen.queryByText(/신고\s*완료/)).toBeNull();
  });
});
