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
});
