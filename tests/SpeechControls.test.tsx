import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpeechControls } from '@/components/SpeechControls';

/**
 * PRD FR-07/TDD §3.7: 서버가 실제 오디오(`audio/mpeg`)를 반환하면 그 음성을 재생해야 하고,
 * 서버가 JSON `speech_status: 'browser_fallback'`을 반환하거나 호출 자체가 실패하면
 * 브라우저 `speechSynthesis`로 폴백해야 한다. 지금까지 컴포넌트는 `/api/ai/speech`를 전혀
 * 호출하지 않고 항상 브라우저 음성만 썼다 — 이 테스트는 그 회귀를 막는다.
 */
describe('SpeechControls — real server TTS with browser fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubAudioPlayback() {
    const play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:fake');
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
    return play;
  }

  it('requests server TTS for the given assistant_turn_id and plays the returned audio instead of only using speechSynthesis', async () => {
    const play = stubAudioPlayback();
    const speakSpy = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: speakSpy, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/api/ai/speech');
      const body = JSON.parse(String(init?.body));
      expect(body.assistant_turn_id).toBe('turn-123');
      return {
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'audio/mpeg' : null) },
        arrayBuffer: async () => audioBytes.buffer,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SpeechControls text="도움을 준비했어요." assistantTurnId="turn-123" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 듣기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai/speech', expect.anything()));
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(speakSpy).not.toHaveBeenCalled();
  });

  it('falls back to browser speechSynthesis when the server responds with speech_status: browser_fallback', async () => {
    const speakSpy = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: speakSpy, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn().mockImplementation(function (this: Record<string, unknown>, text: string) { this.text = text; }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => ({ assistant_turn_id: 'turn-123', speech_status: 'browser_fallback', text: '도움을 준비했어요.' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SpeechControls text="도움을 준비했어요." assistantTurnId="turn-123" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 듣기' }));

    await waitFor(() => expect(speakSpy).toHaveBeenCalled());
  });

  it('falls back to browser speechSynthesis when the server call itself fails (network/timeout)', async () => {
    const speakSpy = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: speakSpy, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn().mockImplementation(function (this: Record<string, unknown>, text: string) { this.text = text; }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<SpeechControls text="도움을 준비했어요." assistantTurnId="turn-123" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 듣기' }));

    await waitFor(() => expect(speakSpy).toHaveBeenCalled());
  });

  it('still works with only browser speechSynthesis when no assistant_turn_id is available (e.g. static prompts)', () => {
    const speakSpy = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: speakSpy, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn().mockImplementation(function (this: Record<string, unknown>, text: string) { this.text = text; }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<SpeechControls text="오늘 기억나는 좋은 일이 있으세요?" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 듣기' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(speakSpy).toHaveBeenCalled();
  });
});
