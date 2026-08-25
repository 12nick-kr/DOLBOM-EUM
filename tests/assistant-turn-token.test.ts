import { describe, expect, it } from 'vitest';
import { createAssistantTurnToken, verifyAssistantTurnToken } from '@/lib/server/assistantTurnToken';

const env = { OPENAI_API_KEY: 'test-signing-key' };

describe('signed assistant speech token', () => {
  it('carries only the server-approved assistant text across serverless route instances', () => {
    const token = createAssistantTurnToken({ id: 'turn-1', seniorId: 'senior-1', text: '보내시겠습니까?' }, env);
    expect(verifyAssistantTurnToken(token, { id: 'turn-1', seniorId: 'senior-1' }, env)?.text).toBe('보내시겠습니까?');
  });

  it('rejects a forged token and a token replayed for another senior', () => {
    const token = createAssistantTurnToken({ id: 'turn-1', seniorId: 'senior-1', text: '원래 답변' }, env);
    expect(verifyAssistantTurnToken(`${token}x`, { id: 'turn-1', seniorId: 'senior-1' }, env)).toBeNull();
    expect(verifyAssistantTurnToken(token, { id: 'turn-1', seniorId: 'senior-2' }, env)).toBeNull();
  });
});
