import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
