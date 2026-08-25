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
    // 0.5초 분량의 실제 무음 PCM 데이터가 있는 WAV를 보낸다. data 청크 길이가 0이면 OpenAI가
    // "Audio file might be corrupted or unsupported"(400)로 거부하므로, API 연결·스코프 확인에는
    // 최소한 유효한 payload 길이가 필요하다(전사 정확도 자체는 검증하지 않는다).
    const sampleRate = 16000;
    const numSamples = Math.floor(sampleRate * 0.5);
    const dataSize = numSamples * 2;
    const wav = Buffer.alloc(44 + dataSize);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(dataSize, 40);
    // 나머지 바이트는 Buffer.alloc이 0으로 채운 무음 샘플 그대로 둔다.
    const r = await ai.transcribe(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer, 'audio/wav');
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
