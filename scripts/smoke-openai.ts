/**
 * PRD §14.2 출시 직전 실행 확인 체크 — OpenAI 3종(Responses/Transcription/Speech) smoke test.
 * 최소 요청 1건씩만 보내고, 성공/실패 여부만 stdout에 남긴다. 절대 응답 본문·키·토큰 값을 출력하지 않는다.
 * 실행: npx tsx scripts/smoke-openai.ts (owner가 로컬에서 직접 실행하고 결과만 개발 로그에 남긴다)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOpenAiPort } from '../lib/server/openaiAdapter';

/** 최소한의 .env 로더 — 새 의존성을 추가하지 않기 위해 직접 파싱한다. 값은 절대 출력하지 않는다. */
function loadDotEnv(path: string) {
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadDotEnv(resolve(__dirname, '..', '.env'));
  const hasCreds = Boolean(process.env.OPENAI_API_KEY) && Boolean(process.env.OPENAI_PROJECT_ID);
  if (!hasCreds) {
    console.log('OPENAI_API_KEY/OPENAI_PROJECT_ID 없음 — smoke test 건너뜀');
    process.exit(1);
  }

  const ai = createOpenAiPort(process.env);
  const results: Record<string, 'pass' | 'fail'> = {};

  try {
    const r = await ai.classifyAndDraft({ text: '오늘 기분이 좋아요' });
    results.responses = r ? 'pass' : 'fail';
  } catch {
    results.responses = 'fail';
  }

  try {
    // 최소 크기의 유효한 WAV 헤더만 보내 API 연결과 스코프만 확인한다(전사 정확도는 검증하지 않음).
    const silentWav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
      0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x00, 0x7d, 0x00, 0x00,
      0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
    ]);
    const r = await ai.transcribe(silentWav.buffer as ArrayBuffer, 'audio/wav');
    results.transcription = typeof r.transcript === 'string' ? 'pass' : 'fail';
  } catch {
    results.transcription = 'fail';
  }

  try {
    const r = await ai.speech('안녕하세요');
    results.speech = r.audio && r.audio.byteLength > 0 ? 'pass' : 'fail';
  } catch {
    results.speech = 'fail';
  }

  console.log('OpenAI smoke test 결과 (실제 값 아님, pass/fail만):');
  console.log(JSON.stringify(results, null, 2));
  const allPass = Object.values(results).every((v) => v === 'pass');
  process.exit(allPass ? 0 : 1);
}

main();
