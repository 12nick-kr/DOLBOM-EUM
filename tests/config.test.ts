import { describe, expect, it } from 'vitest';
import { missingRequiredEnvironment, modelConfig } from '@/lib/config';
describe('safe runtime configuration', () => {
  it('returns missing variable names without inspecting values', () => expect(missingRequiredEnvironment({})).toEqual(['OPENAI_API_KEY', 'OPENAI_PROJECT_ID']));
  it('uses centralized model defaults', () => expect(modelConfig).toMatchObject({ text: 'gpt-5.6-terra', transcribe: 'gpt-transcribe', tts: 'gpt-4o-mini-tts' }));
});
