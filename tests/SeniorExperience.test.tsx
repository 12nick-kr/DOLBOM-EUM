import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeniorExperience } from '@/components/SeniorExperience';
describe('senior accessible entry', () => {
  it('renders a large one-tap speaking action, text alternative and fixed emergency action', () => { render(<SeniorExperience />); expect(screen.getByRole('button', { name: '말하기 시작' })).toBeVisible(); expect(screen.getByLabelText('도움 요청 입력')).toBeVisible(); expect(screen.getByRole('button', { name: '긴급 도움' })).toBeVisible(); });
  it('applies the comfort density scale token to the senior screen root', () => { const { container } = render(<SeniorExperience />); expect(container.querySelector('[data-density="comfort"]')).not.toBeNull(); });
  it('opens the emergency screen without any AI request', () => { render(<SeniorExperience />); fireEvent.click(screen.getByRole('button', { name: '긴급 도움' })); expect(screen.getByRole('heading')).toHaveTextContent('지금 119에전화할까요?'); expect(screen.getByRole('link', { name: /119 전화하기/ })).toHaveAttribute('href', 'tel:119'); });
  it('shows speech controls for an assistant answer', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ assistant_text: '도움을 준비했어요.', intent: 'conversation', urgency: 'normal' }) })); render(<SeniorExperience />); fireEvent.click(screen.getByRole('button', { name: '보내기' })); expect(await screen.findByText('도움을 준비했어요.')).toBeVisible(); expect(screen.getByRole('button', { name: '다시 듣기' })).toBeVisible(); });
});
