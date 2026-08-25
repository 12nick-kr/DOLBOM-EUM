import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { WorkerDashboard } from '@/components/WorkerDashboard';

const seedCard = {
  id: 'request-seed', seniorId: 'senior-demo-001', type: 'hospital_escort', summary: '병원 동행 도움이 필요해요.',
  transcript: '원문', inputType: 'voice', details: { destination: '충남대학교병원' }, missingFields: [],
  status: 'new', assigneeId: null, acknowledgedAt: null, createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
};

describe('WorkerDashboard — inbox driven by real API + realtime, not hardcoded mock data (Phase 4)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('renders the inbox from GET /api/service-requests instead of a hardcoded array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: [seedCard], is_demo: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkerDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /요청 업무함/ }));
    await waitFor(() => expect(screen.getByText('병원 동행 도움이 필요해요.')).toBeVisible());
    expect(fetchMock).toHaveBeenCalledWith('/api/care-cards');
  });

  it('adds a newly confirmed senior request to the inbox without a page reload when the poller detects it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: [], is_demo: true }) }) // initial hydrate
      .mockResolvedValue({ json: async () => ({ data: [seedCard], is_demo: true }) }); // subsequent polls see the new card
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkerDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /요청 업무함/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });

    await waitFor(() => expect(screen.getByText('병원 동행 도움이 필요해요.')).toBeVisible());
  });

  it('optimistically removes a card after the worker confirms server deletion', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/care-cards') return { ok: true, json: async () => ({ data: [seedCard] }) };
      if (url === '/api/emergencies') return { ok: true, json: async () => ({ data: [] }) };
      if (String(url).includes('/api/service-requests/') && init?.method === 'DELETE') return { ok: true, json: async () => ({ deleted: true, id: seedCard.id }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkerDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /요청 업무함/ }));
    await screen.findByText(seedCard.summary);
    fireEvent.click(screen.getByRole('button', { name: '요청 삭제' }));
    const dialog = screen.getByRole('dialog', { name: '이 요청을 삭제할까요?' });
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.queryByText(seedCard.summary)).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(`/api/service-requests/${seedCard.id}`, { method: 'DELETE' });
  });

  it('shows the complete action only for in-progress cards and calls the dedicated endpoint', async () => {
    const inProgress = { ...seedCard, status: 'in_progress', assigneeId: 'worker-demo-001' };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/care-cards') return { ok: true, json: async () => ({ data: [inProgress] }) };
      if (url === '/api/emergencies') return { ok: true, json: async () => ({ data: [] }) };
      if (String(url).endsWith('/complete') && init?.method === 'POST') return { ok: true, json: async () => ({ ...inProgress, status: 'done', completedAt: new Date().toISOString() }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkerDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /요청 업무함/ }));
    await screen.findByText(inProgress.summary);
    fireEvent.click(screen.getByRole('button', { name: '상세 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '처리 완료' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/service-requests/${inProgress.id}/complete`, { method: 'POST' }));
  });

  it('optimistically removes an emergency after the assigned worker confirms hard delete', async () => {
    const emergency = { id: 'emergency-delete-1', seniorId: seedCard.seniorId, utterance: '숨쉬기가 힘들어요.', location: '대전광역시 중구', level: 'emergency', status: 'detected', createdAt: '2026-08-25T00:00:00Z', actions: [] };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/care-cards') return { ok: true, json: async () => ({ data: [seedCard] }) };
      if (url === '/api/emergencies' && !init?.method) return { ok: true, json: async () => ({ data: [emergency] }) };
      if (url === `/api/emergencies/${emergency.id}` && init?.method === 'DELETE') return { ok: true, json: async () => ({ deleted: true }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkerDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: /자세히 보기/ }));
    fireEvent.click(screen.getByRole('button', { name: '긴급 알림 해제 및 삭제' }));
    const dialog = screen.getByRole('dialog', { name: '긴급 알림을 해제하고 삭제할까요?' });
    fireEvent.click(within(dialog).getByRole('button', { name: '해제 및 삭제' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/emergencies/${emergency.id}`, { method: 'DELETE' }));
    expect(screen.queryByText(emergency.utterance)).toBeNull();
  });
});

describe('로그인한 계정 기준 표시 (하드코딩 데모 이름 금지)', () => {
  it('인사말과 담당 노인 이름을 세션·카드에서 가져온다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/session') return { ok: true, json: async () => ({ data: { id: 'w-1', role: 'worker', displayName: '정복지' } }) };
      if (url === '/api/care-cards') return { ok: true, json: async () => ({ data: [{ ...seedCard, seniorName: '한말순' }] }) };
      return { ok: true, json: async () => ({ data: [] }) };
    }));
    render(<WorkerDashboard />);
    expect(await screen.findByText('좋은 아침이에요, 정복지님')).toBeVisible();
    expect(screen.queryByText(/박사회복지사/)).toBeNull();
    expect(await screen.findByText('한말순')).toBeVisible();
    expect(screen.queryByText(/김순자/)).toBeNull();
  });
});
