import { describe, expect, it } from 'vitest';
import { fixtureAi } from '@/lib/server/ai';
import { selectAiPort } from '@/lib/server/aiFactory';

describe('AiPort — fixture adapter used in tests (TDD §3.6/§3.11: no real network in unit tests)', () => {
  it('fixture transcribe returns a demo transcript without any network call', async () => {
    const result = await fixtureAi.transcribe(new ArrayBuffer(0), 'audio/webm');
    expect(result.isDemo).toBe(true);
    expect(result.transcript.length).toBeGreaterThan(0);
  });

  it('fixture classifyAndDraft mirrors the regex classifier shape', async () => {
    const result = await fixtureAi.classifyAndDraft({ text: '가슴이 아프고 숨이 차요' });
    expect(result.urgency).toBe('emergency');
  });

  it('fixture speech returns a non-null buffer for demo text', async () => {
    const result = await fixtureAi.speech('안녕하세요');
    expect(result.isDemo).toBe(true);
  });
});

describe('selectAiPort — single decision point for real vs fixture adapter (PRD §11.5)', () => {
  it('selects the fixture adapter when OpenAI credentials are missing', () => {
    const { provider } = selectAiPort({});
    expect(provider).toBe('fixture');
  });

  it('selects the real OpenAI adapter when both credentials are present', () => {
    const { provider } = selectAiPort({ OPENAI_API_KEY: 'sk-test', OPENAI_PROJECT_ID: 'proj-test' });
    expect(provider).toBe('openai');
  });

  it('falls back to fixture when only one of the two credentials is present', () => {
    expect(selectAiPort({ OPENAI_API_KEY: 'sk-test' }).provider).toBe('fixture');
    expect(selectAiPort({ OPENAI_PROJECT_ID: 'proj-test' }).provider).toBe('fixture');
  });
});
