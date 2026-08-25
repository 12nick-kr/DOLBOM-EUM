import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * jsdom(vitest test environment)의 전역 `FormData`/`Blob`은 Next의 `NextRequest.formData()`가
 * 기대하는 undici 구현과 미묘하게 달라 `Content-Type: multipart/form-data; boundary=...` 헤더가
 * 자동으로 붙지 않는다. 그래서 테스트에서는 멀티파트 본문을 직접 구성해 헤더를 명시적으로 지정한다 —
 * 실제 브라우저/Node 런타임에서는 `fetch(url, { body: formData })`가 이 헤더를 자동으로 채운다.
 */
function multipartRequest(parts: { name: string; filename?: string; contentType?: string; data: Uint8Array | string }[]): NextRequest {
  const boundary = `----testboundary${Math.random().toString(16).slice(2)}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.contentType) header += `Content-Type: ${part.contentType}\r\n`;
    header += '\r\n';
    chunks.push(encoder.encode(header));
    chunks.push(typeof part.data === 'string' ? encoder.encode(part.data) : part.data);
    chunks.push(encoder.encode('\r\n'));
  }
  chunks.push(encoder.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }

  return new NextRequest('http://localhost:3000/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe('POST /api/ai/transcribe — real multipart upload handling (PRD §11.1/§12)', () => {
  it('rejects a request with no audio field', async () => {
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const req = multipartRequest([]);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects an empty audio blob', async () => {
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const req = multipartRequest([{ name: 'audio', filename: 'speech.webm', contentType: 'audio/webm', data: new Uint8Array([]) }]);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects an oversized audio blob', async () => {
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const big = new Uint8Array(11 * 1024 * 1024);
    const req = multipartRequest([{ name: 'audio', filename: 'speech.webm', contentType: 'audio/webm', data: big }]);
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('rejects a non-audio mime type', async () => {
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const req = multipartRequest([{ name: 'audio', filename: 'notes.txt', contentType: 'text/plain', data: new Uint8Array([1, 2, 3]) }]);
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it('transcribes a valid audio blob through the fixture adapter (no credentials in test env) and never echoes the raw audio bytes back', async () => {
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const req = multipartRequest([{ name: 'audio', filename: 'speech.webm', contentType: 'audio/webm', data: new Uint8Array([1, 2, 3, 4]) }]);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.transcript).toBe('string');
    expect(data.transcript.length).toBeGreaterThan(0);
    expect(Object.keys(data)).not.toContain('audio');
    expect(Object.keys(data)).not.toContain('rawAudio');
  });
});
