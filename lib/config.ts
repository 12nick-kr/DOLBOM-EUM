export const modelConfig = {
  text: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
  transcribe: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe',
  tts: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
} as const;

const required = ['OPENAI_API_KEY', 'OPENAI_PROJECT_ID'] as const;
export function missingRequiredEnvironment(env: Record<string, string | undefined> = process.env): string[] {
  return required.filter((name) => !env[name]);
}
