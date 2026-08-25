const allowed = new Map<string, string>([['application/pdf', '%PDF'], ['image/jpeg', '\u00ff\u00d8\u00ff'], ['image/png', '\u0089PNG']]);
export function validateDocument(file: { type: string; size: number; bytes: Uint8Array }): { valid: boolean; error?: string } {
  if (!allowed.has(file.type)) return { valid: false, error: 'PDF, JPEG, PNG 형식만 업로드할 수 있어요.' };
  if (file.size > 5 * 1024 * 1024) return { valid: false, error: '파일은 5MB 이하여야 해요.' };
  const header = String.fromCharCode(...file.bytes.slice(0, 4));
  if (!header.startsWith(allowed.get(file.type)!)) return { valid: false, error: '파일 형식이 올바르지 않아요.' };
  return { valid: true };
}
export function secureObjectPath(seniorId: string, documentId: string, extension: 'pdf' | 'jpg' | 'png'): string { return `${seniorId}/${documentId}/original.${extension}`; }
