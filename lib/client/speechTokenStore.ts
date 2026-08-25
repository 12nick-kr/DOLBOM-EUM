const speechTokens = new Map<string, string>();

export function registerAssistantSpeechToken(turnId: string | undefined, token: string | undefined): void {
  if (!turnId || !token) return;
  speechTokens.set(turnId, token);
  if (speechTokens.size > 30) speechTokens.delete(speechTokens.keys().next().value as string);
}

export function getAssistantSpeechToken(turnId: string | undefined): string | undefined {
  return turnId ? speechTokens.get(turnId) : undefined;
}
