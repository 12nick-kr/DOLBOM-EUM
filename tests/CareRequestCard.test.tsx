import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CareRequestCard } from '@/components/CareRequestCard';

const card = {
  id: 'request-card-1', seniorId: 'senior-1', sourceEventId: 'event-1', type: 'hospital_escort' as const,
  summary: '충남대학교병원 동행이 필요해요.', transcript: '원문 발화', inputType: 'voice' as const,
  details: { destination: '충남대학교병원' }, missingFields: [], status: 'new' as const,
  assigneeId: null, acknowledgedAt: null, createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
};

describe('CareRequestCard shared role rendering', () => {
  it('uses the same card component while hiding transcript from family', () => {
    const { rerender } = render(<CareRequestCard card={card} role="family" />);
    expect(screen.getByText(card.summary)).toBeVisible();
    expect(screen.queryByText('원문 발화')).toBeNull();

    rerender(<CareRequestCard card={card} role="worker" />);
    expect(screen.getByText('원문 발화')).toBeVisible();
  });

  it('uses senior-friendly status language for the senior role', () => {
    render(<CareRequestCard card={card} role="senior" />);
    expect(screen.getByText('담당자에게 보냈어요')).toBeVisible();
  });

  it('renders a worker-only delete control in the card heading', () => {
    const onDelete = vi.fn();
    const { rerender } = render(<CareRequestCard card={card} role="worker" onDelete={onDelete} />);
    const button = screen.getByRole('button', { name: '요청 삭제' });
    expect(button.closest('.care-card-heading')).not.toBeNull();
    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalledWith(card.id);

    rerender(<CareRequestCard card={card} role="family" onDelete={onDelete} />);
    expect(screen.queryByRole('button', { name: '요청 삭제' })).toBeNull();
  });
});
