import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { FakeRealtimeClient } from '@/lib/client/realtimePort';
import type { ServiceRequest } from '@/lib/domain/types';

function card(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'r1', seniorId: 'senior-1', type: 'hospital_escort', summary: 's', transcript: 't', inputType: 'voice',
    details: {}, missingFields: [], status: 'new', assigneeId: null, acknowledgedAt: null, createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
    ...overrides,
  };
}

function Harness({ realtime }: { realtime: FakeRealtimeClient }) {
  const { requests, connectionState, unreadCount } = useServiceRequestList({ realtime, fetchList: async () => [card({ id: 'seed' })] });
  return <div>
    <div data-testid="count">{requests.length}</div>
    <div data-testid="connection">{connectionState}</div>
    <div data-testid="unread">{unreadCount}</div>
    {requests.map((r) => <div key={r.id} data-testid="row">{r.id}:{r.status}</div>)}
  </div>;
}

describe('useServiceRequestList — worker inbox realtime sync (Phase 4 key deliverable)', () => {
  it('fetches the initial list on mount before any realtime event', async () => {
    const realtime = new FakeRealtimeClient();
    render(<Harness realtime={realtime} />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(screen.getByText('seed:new')).toBeVisible();
  });

  it('adds a new card to the top of the list without a page reload when a realtime insert event arrives', async () => {
    const realtime = new FakeRealtimeClient();
    render(<Harness realtime={realtime} />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    act(() => { realtime.emit({ type: 'insert', request: card({ id: 'incoming', updatedAt: '2026-08-25T05:00:00Z', createdAt: '2026-08-25T05:00:00Z' }) }); });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
    expect(screen.getByText('incoming:new')).toBeVisible();
  });

  it('increments unread count on new realtime cards', async () => {
    const realtime = new FakeRealtimeClient();
    render(<Harness realtime={realtime} />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    act(() => { realtime.emit({ type: 'insert', request: card({ id: 'incoming2' }) }); });
    await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('1'));
  });

  it('does not clear the list when the realtime connection drops, and shows disconnected state', async () => {
    const realtime = new FakeRealtimeClient();
    render(<Harness realtime={realtime} />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    act(() => { realtime.setConnectionState('disconnected'); });
    await waitFor(() => expect(screen.getByTestId('connection')).toHaveTextContent('disconnected'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('re-fetches from the server on reconnect to fill any missed events', async () => {
    const realtime = new FakeRealtimeClient();
    const fetchList = vi.fn()
      .mockResolvedValueOnce([card({ id: 'seed' })])
      .mockResolvedValueOnce([card({ id: 'seed' }), card({ id: 'missed-while-disconnected' })]);
    function ReconnectHarness() {
      const { requests, connectionState } = useServiceRequestList({ realtime, fetchList });
      return <div><div data-testid="count">{requests.length}</div><div data-testid="connection">{connectionState}</div></div>;
    }
    render(<ReconnectHarness />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    act(() => { realtime.setConnectionState('disconnected'); });
    await waitFor(() => expect(screen.getByTestId('connection')).toHaveTextContent('disconnected'));
    act(() => { realtime.setConnectionState('connected'); });
    await waitFor(() => expect(fetchList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
  });

  it('still shows the same data through a plain fetch when realtime is entirely unavailable', async () => {
    // No realtime port injected at all — the hook must fall back to fetch-only mode.
    function NoRealtimeHarness() {
      const { requests } = useServiceRequestList({ realtime: null, fetchList: async () => [card({ id: 'fetch-only' })] });
      return <div data-testid="count">{requests.length}</div>;
    }
    render(<NoRealtimeHarness />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
  });
});
