import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeniorExperience } from '@/components/SeniorExperience';

/** 모든 렌더가 마운트 시 GET /api/service-requests를 호출하므로(useServiceRequestList), 각 테스트는
 * 그 경로도 처리하는 fetch mock을 준비한다 — 준비하지 않으면 실제 네트워크 호출이 시도되어 실패한다. */
function stubFetch(handlers: { respond?: unknown[]; myRequests?: unknown[]; transcript?: string } = {}) {
  const respondQueue = [...(handlers.respond ?? [])];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/care-cards' && (!init || init.method === undefined)) {
      return { json: async () => ({ data: handlers.myRequests ?? [], is_demo: true }) };
    }
    if (url === '/api/senior-inputs') {
      return { ok: true, json: async () => ({ id: 'request-new-1', status: 'new' }) };
    }
    if (url === '/api/emergencies') {
      return { ok: true, json: async () => ({ id: 'emergency-new-1', status: 'detected' }) };
    }
    if (url === '/api/ai/transcribe') {
      return { ok: true, json: async () => ({ transcript: handlers.transcript ?? '다음 주 병원에 같이 가 주세요.' }) };
    }
    const next = respondQueue.shift();
    return { json: async () => next ?? { assistant_text: '', intent: 'conversation', urgency: 'normal' } };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('senior accessible entry', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders a large one-tap speaking action, text alternative and fixed emergency action', () => {
    stubFetch();
    render(<SeniorExperience />);
    expect(screen.getByRole('button', { name: '말하기 시작' })).toBeVisible();
    expect(screen.getByLabelText('도움 요청 입력')).toBeVisible();
    expect(screen.getByRole('button', { name: '긴급 도움' })).toBeVisible();
  });

  it('applies the comfort density scale token to the senior screen root', () => {
    stubFetch();
    const { container } = render(<SeniorExperience />);
    expect(container.querySelector('[data-density="comfort"]')).not.toBeNull();
  });

  it('opens the emergency screen without any AI request', () => {
    stubFetch();
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '긴급 도움' }));
    expect(screen.getByRole('heading')).toHaveTextContent('지금 119에전화할까요?');
  });

  it('renders the emergency screen even when the network/AI backend is completely unavailable', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '긴급 도움' }));
    expect(screen.getByRole('heading')).toHaveTextContent('지금 119에전화할까요?');
    expect(screen.getByRole('button', { name: /^119 전화하기/ })).toBeVisible();
  });

  it('requires one explicit confirmation before the tel: link becomes active — the call button is not itself a live tel: link', () => {
    stubFetch();
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '긴급 도움' }));
    const callButton = screen.getByRole('button', { name: /^119 전화하기/ });
    // Before confirming, there must be no live tel: link on the page (accidental dialing must be impossible).
    expect(screen.queryByRole('link', { name: /119/ })).toBeNull();
    fireEvent.click(callButton);
    // After the one confirmation, the tel: link appears.
    expect(screen.getByRole('link', { name: /119/ })).toHaveAttribute('href', 'tel:119');
  });

  it('never shows a message claiming the emergency report was actually sent/completed', () => {
    stubFetch();
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '긴급 도움' }));
    expect(screen.queryByText(/신고\s*완료/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^119 전화하기/ }));
    expect(screen.queryByText(/신고\s*완료/)).toBeNull();
  });

  it('notifies family and worker through the real emergency API (audit trail), not a browser alert', async () => {
    const fetchMock = stubFetch();
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '긴급 도움' }));
    fireEvent.click(screen.getByRole('button', { name: '가족에게 알리기' }));
    await Promise.resolve();
    const emergencyCall = fetchMock.mock.calls.find((call) => call[0] === '/api/emergencies');
    expect(emergencyCall).toBeDefined();
  });

  it('routes text input through original-text review before AI analysis', async () => {
    const fetchMock = stubFetch({ respond: [{ assistant_text: '요청 내용을 정리했어요. 맞는지 확인해 주세요.', intent: 'service_request', urgency: 'welfare', draft: { seniorId: 'senior-demo-001', type: 'daily_help', summary: '장보기 도움이 필요해요.', transcript: '장보기를 도와주세요.', inputType: 'text', details: {}, missingFields: [] } }] });
    render(<SeniorExperience />);
    fireEvent.change(screen.getByLabelText('도움 요청 입력'), { target: { value: '장보기를 도와주세요.' } });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    expect(screen.getByRole('heading', { name: '입력한 내용이 맞나요?' })).toBeVisible();
    expect(screen.getByText('장보기를 도와주세요.')).toBeVisible();
    expect(fetchMock.mock.calls.some((call) => call[0] === '/api/ai/respond')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '이 내용 분석하기' }));
    expect(await screen.findByText('일상 도움 요청이에요')).toBeVisible();
    const analysisCall = fetchMock.mock.calls.find((call) => call[0] === '/api/ai/respond');
    expect(JSON.parse(String(analysisCall?.[1]?.body)).purpose).toBe('service_request');
  });

  it('shows the AI-generated draft summary with an AI badge and only registers the card after explicit confirmation', async () => {
    const draft = { seniorId: 'senior-demo-001', type: 'hospital_escort', summary: '충남대학교병원 병원 동행 도움을 요청했어요.', transcript: '다음 주 화요일 충남대병원 갈 때 같이 갈 사람이 필요해요.', inputType: 'text', details: { destination: '충남대학교병원' }, missingFields: [] };
    const fetchMock = stubFetch({ respond: [{ assistant_text: '요청 내용을 정리했어요. 맞는지 확인해 주세요.', intent: 'service_request', urgency: 'welfare', draft }] });
    render(<SeniorExperience />);
    fireEvent.change(screen.getByLabelText('도움 요청 입력'), { target: { value: draft.transcript } });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    fireEvent.click(screen.getByRole('button', { name: '이 내용 분석하기' }));
    expect(await screen.findByText('병원 동행 요청이에요')).toBeVisible();
    expect(screen.getByText('텍스트 입력 원문')).toBeVisible();
    expect(screen.getByText(draft.transcript)).toBeVisible();
    expect(screen.getByText('AI 요약')).toBeVisible();
    expect(screen.getByText(draft.summary)).toBeVisible();
    expect(fetchMock.mock.calls.some((call) => call[0] === '/api/senior-inputs')).toBe(false);
    // Confirming must call the service-requests endpoint with a confirmed:true idempotency-keyed payload.
    fireEvent.click(screen.getByRole('button', { name: '보내주세요' }));
    await screen.findByText('내 요청 보기');
    const confirmCall = fetchMock.mock.calls.find((call) => call[0] === '/api/senior-inputs' && call[1]?.method === 'POST');
    expect(confirmCall).toBeDefined();
    const body = JSON.parse(String(confirmCall![1]!.body));
    expect(body.confirmed).toBe(true);
    expect(typeof body.idempotencyKey).toBe('string');
    expect(body.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('routes a voice transcript through the same review and request-card screens', async () => {
    const transcript = '내일 병원에 같이 가 주세요.';
    const draft = { seniorId: 'senior-demo-001', type: 'hospital_escort', summary: '내일 병원 동행을 요청했어요.', transcript, inputType: 'voice', details: { desiredAt: '내일' }, missingFields: [] };
    stubFetch({ transcript, respond: [{ assistant_text: '요청 내용을 정리했어요. 맞는지 확인해 주세요.', intent: 'service_request', urgency: 'welfare', draft }] });

    const trackStop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] })) } });
    class FakeMediaRecorder {
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);

    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '말하기 시작' }));
    fireEvent.click(await screen.findByRole('button', { name: '녹음 마치기' }));
    expect(await screen.findByRole('heading', { name: '입력한 내용이 맞나요?' })).toBeVisible();
    expect(screen.getByText(transcript)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '이 내용 분석하기' }));
    expect(await screen.findByText('병원 동행 요청이에요')).toBeVisible();
    expect(screen.getByText('음성 인식 원문')).toBeVisible();
    expect(screen.getByText(draft.summary)).toBeVisible();
    expect(trackStop).toHaveBeenCalled();
  });

  it('removes the companion feature from the senior navigation and layout', () => {
    stubFetch();
    render(<SeniorExperience />);
    expect(screen.queryByRole('button', { name: /말동무/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: '말동무' })).toBeNull();
  });

  it('prevents duplicate AI analysis requests while a request is in flight', async () => {
    let resolveResponse: ((value: unknown) => void) | undefined;
    const response = new Promise((resolve) => { resolveResponse = resolve; });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/care-cards') return { ok: true, json: async () => ({ data: [] }) };
      if (url === '/api/ai/respond') return response;
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    const analyze = screen.getByRole('button', { name: '이 내용 분석하기' });
    fireEvent.click(analyze);
    fireEvent.click(analyze);
    expect(screen.getByText('AI가 신청 내용을 정리하고 있어요.', { selector: '[role="status"]' })).toBeVisible();
    expect(fetchMock.mock.calls.filter((call) => call[0] === '/api/ai/respond')).toHaveLength(1);
    resolveResponse?.({ ok: true, json: async () => ({ assistant_text: '정리했어요.', intent: 'service_request', urgency: 'welfare', draft: { seniorId: 'senior-demo-001', type: 'daily_help', summary: '일상 도움 요청', transcript: '다음 주 병원 갈 때 같이 갈 사람이 필요해요.', inputType: 'text', details: {}, missingFields: [] } }) });
    await waitFor(() => expect(screen.getByText('일상 도움 요청이에요')).toBeVisible());
  });

  it('keeps the emergency screen open when an older AI response arrives late', async () => {
    let resolveResponse: ((value: unknown) => void) | undefined;
    const response = new Promise((resolve) => { resolveResponse = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/care-cards') return { ok: true, json: async () => ({ data: [] }) };
      if (url === '/api/ai/respond') return response;
      return { ok: true, json: async () => ({}) };
    }));
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    fireEvent.click(screen.getByRole('button', { name: '이 내용 분석하기' }));
    fireEvent.click(screen.getByRole('button', { name: '긴급 도움' }));
    expect(screen.getByRole('heading')).toHaveTextContent('지금 119에전화할까요?');

    resolveResponse?.({ ok: true, json: async () => ({ assistant_text: '정리했어요.', intent: 'service_request', urgency: 'welfare', draft: { seniorId: 'senior-demo-001', type: 'daily_help', summary: '일상 도움 요청', transcript: '요청 원문', inputType: 'text', details: {}, missingFields: [] } }) });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('heading')).toHaveTextContent('지금 119에전화할까요?');
  });

  it('reflects a worker status change on the "내 요청" screen by re-fetching from the server, not only local confirm state', async () => {
    const inProgressCard = { id: 'request-existing', seniorId: 'senior-demo-001', type: 'hospital_escort', summary: '병원 동행 도움이 필요해요.', transcript: 't', inputType: 'voice', details: {}, missingFields: [], status: 'in_progress', assigneeId: 'worker-demo-001', acknowledgedAt: '2026-08-25T01:00:00Z', createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T01:00:00Z' };
    stubFetch({ myRequests: [inProgressCard] });
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: /내 요청 보기/ }));
    expect((await screen.findAllByText('담당자가 확인 중이에요')).length).toBeGreaterThan(0);
  });
});
