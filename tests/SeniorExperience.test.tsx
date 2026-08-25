import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeniorExperience } from '@/components/SeniorExperience';
describe('senior accessible entry', () => {
  it('renders a large one-tap speaking action, text alternative and fixed emergency action', () => { render(<SeniorExperience />); expect(screen.getByRole('button', { name: '말하기 시작' })).toBeVisible(); expect(screen.getByLabelText('도움 요청 입력')).toBeVisible(); expect(screen.getByRole('button', { name: '긴급 도움' })).toBeVisible(); });
  it('applies the comfort density scale token to the senior screen root', () => { const { container } = render(<SeniorExperience />); expect(container.querySelector('[data-density="comfort"]')).not.toBeNull(); });
  it('opens the emergency screen without any AI request', () => { render(<SeniorExperience />); fireEvent.click(screen.getByRole('button', { name: '긴급 도움' })); expect(screen.getByRole('heading')).toHaveTextContent('지금 119에전화할까요?'); expect(screen.getByRole('link', { name: /119 전화하기/ })).toHaveAttribute('href', 'tel:119'); });
  it('shows speech controls for an assistant answer', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ assistant_text: '도움을 준비했어요.', intent: 'conversation', urgency: 'normal' }) })); render(<SeniorExperience />); fireEvent.click(screen.getByRole('button', { name: '보내기' })); expect(await screen.findByText('도움을 준비했어요.')).toBeVisible(); expect(screen.getByRole('button', { name: '다시 듣기' })).toBeVisible(); });

  it('shows the AI-generated draft summary with an AI badge and only registers the card after explicit confirmation', async () => {
    const draft = { seniorId: 'senior-demo-001', type: 'hospital_escort', summary: '충남대학교병원 병원 동행 도움을 요청했어요.', transcript: '다음 주 화요일 충남대병원 갈 때 같이 갈 사람이 필요해요.', inputType: 'text', details: { destination: '충남대학교병원' }, missingFields: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ assistant_text: '요청 내용을 정리했어요. 맞는지 확인해 주세요.', intent: 'service_request', urgency: 'welfare', draft }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'request-new-1', status: 'new' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<SeniorExperience />);
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    expect(await screen.findByText('병원 동행 요청이에요')).toBeVisible();
    expect(screen.getByText('AI')).toBeVisible();
    // Confirming must call the service-requests endpoint with a confirmed:true idempotency-keyed payload.
    fireEvent.click(screen.getByRole('button', { name: '보내주세요' }));
    await screen.findByText('내 요청 보기');
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0]).toBe('/api/service-requests');
    const body = JSON.parse(secondCall[1].body);
    expect(body.confirmed).toBe(true);
    expect(typeof body.idempotencyKey).toBe('string');
    expect(body.idempotencyKey.length).toBeGreaterThan(0);
  });
});
