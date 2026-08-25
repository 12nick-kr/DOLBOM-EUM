import { describe, expect, it } from 'vitest';
import { respondToUtterance } from '@/lib/server/chatUseCase';
import { fixtureAi } from '@/lib/server/ai';

describe('chat use case — text and voice share one structure (PRD FR-04, FR-07)', () => {
  it('produces an assistant turn with text and idle speech status for a text utterance', async () => {
    const turn = await respondToUtterance({ text: '오늘 기분이 좋아요', seniorId: 'senior-1', inputType: 'text' });
    expect(turn.assistant_text).toBeTruthy();
    expect(turn.speech_status).toBe('idle');
    expect(turn.seniorId).toBe('senior-1');
  });

  it('produces the same card shape for voice input, differing only by input_type', async () => {
    const textTurn = await respondToUtterance({ text: '다음 주 화요일 충남대병원 갈 때 같이 갈 사람이 필요해요.', seniorId: 'senior-1', inputType: 'text' });
    const voiceTurn = await respondToUtterance({ text: '다음 주 화요일 충남대병원 갈 때 같이 갈 사람이 필요해요.', seniorId: 'senior-1', inputType: 'voice' });
    expect(textTurn.draft?.type).toBe(voiceTurn.draft?.type);
    expect(textTurn.draft?.details).toEqual(voiceTurn.draft?.details);
    expect(textTurn.draft?.inputType).toBe('text');
    expect(voiceTurn.draft?.inputType).toBe('voice');
  });

  it('classifies a service-request utterance into a draft card, not a raw conversation dump', async () => {
    const turn = await respondToUtterance({ text: '다음 주 화요일 충남대병원 갈 때 같이 갈 사람이 필요해요.', seniorId: 'senior-1', inputType: 'voice' });
    expect(turn.intent).toBe('service_request');
    expect(turn.draft).toBeDefined();
    expect(turn.draft?.type).toBe('hospital_escort');
    expect(turn.draft?.transcript).toContain('충남대병원');
    expect(turn.draft?.summary.length).toBeGreaterThan(0);
  });

  it('asks only one missing field at a time and updates the draft on each answer', async () => {
    const first = await respondToUtterance({ text: '병원 갈 때 같이 갈 사람이 필요해요.', seniorId: 'senior-1', inputType: 'text' });
    expect(first.draft?.missingFields.length).toBeGreaterThanOrEqual(1);
    expect(first.draft?.missingFields.length).toBeLessThanOrEqual(1);

    const second = await respondToUtterance({ text: '다음 주 화요일이요.', seniorId: 'senior-1', inputType: 'text', priorDraft: first.draft! });
    expect(second.draft?.missingFields).not.toContain('희망 날짜');
  });

  it('does not trap the senior in repeated date questions when the single follow-up is still unclear', async () => {
    const first = await respondToUtterance({ text: '병원 갈 때 같이 갈 사람이 필요해요.', seniorId: 'senior-1', inputType: 'voice' });
    const second = await respondToUtterance({ text: '잘 모르겠어요.', seniorId: 'senior-1', inputType: 'voice', priorDraft: first.draft! });
    expect(second.draft?.missingFields).not.toContain('희망 날짜');
    expect(second.draft?.details.dateResolution).toBe('needs_coordination');
    expect(second.assistant_text).toContain('보내시겠습니까');
  });

  it('does not persist anything server-side merely by producing a draft', async () => {
    const turn = await respondToUtterance({ text: '병원 갈 때 같이 갈 사람이 필요해요.', seniorId: 'senior-1', inputType: 'text' });
    expect(turn.draft).toBeDefined();
    // draft is a plain returned object, never written through the repository create() path implicitly.
    expect((turn.draft as unknown as { status?: string }).status).toBeUndefined();
  });

  it('classifies emergency utterances without producing a service-request draft', async () => {
    const turn = await respondToUtterance({ text: '가슴이 아프고 숨이 차요', seniorId: 'senior-1', inputType: 'voice' });
    expect(turn.urgency).toBe('emergency');
    expect(turn.draft).toBeUndefined();
  });

  it('guarantees a draft for the request-creation purpose even when the AI classifies the text as conversation', async () => {
    const conversationAi = {
      ...fixtureAi,
      classifyAndDraft: async () => ({ intent: 'conversation' as const, urgency: 'normal' as const, summary: '일상 대화로 이해했어요.', missing_fields: [], proposed_tool: null, requires_confirmation: false }),
    };
    const turn = await respondToUtterance({ text: '장보기를 부탁하고 싶어요.', seniorId: 'senior-1', inputType: 'text', purpose: 'service_request' }, conversationAi);
    expect(turn.intent).toBe('service_request');
    expect(turn.draft).toMatchObject({ transcript: '장보기를 부탁하고 싶어요.', inputType: 'text', type: 'daily_help' });
  });
});
