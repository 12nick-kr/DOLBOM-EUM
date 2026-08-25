import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEmergencyList } from '@/lib/client/useEmergencyList';

function Probe() {
  useEmergencyList();
  return null;
}

function countEmergencyReads(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => call[0] === '/api/emergencies').length;
}

describe('긴급 알림 폴링은 SSE가 살아 있으면 멈춘다', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('SSE 연결 중에는 주기 폴링을 돌리지 않는다', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Probe />);
    await act(async () => { window.dispatchEvent(new CustomEvent('dolbom:realtime-state', { detail: 'connected' })); });
    const afterConnect = countEmergencyReads(fetchMock);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(countEmergencyReads(fetchMock)).toBe(afterConnect);
  });

  it('SSE가 끊기면 폴링으로 되돌아간다', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Probe />);
    await act(async () => { window.dispatchEvent(new CustomEvent('dolbom:realtime-state', { detail: 'connected' })); });
    await act(async () => { window.dispatchEvent(new CustomEvent('dolbom:realtime-state', { detail: 'disconnected' })); });
    const afterDrop = countEmergencyReads(fetchMock);
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
    expect(countEmergencyReads(fetchMock)).toBeGreaterThan(afterDrop);
  });
});
