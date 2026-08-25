import { NextRequest, NextResponse } from 'next/server';
import { selectAiPort } from '@/lib/server/aiFactory';
import { authenticatedActor } from '@/lib/server/auth';

/** PRD §11.1 "최대 60초"에 대응하는 앱 자체 업로드 상한 — 60초 음성이 이 크기를 넘지 않는다고 가정한 보수적 상한. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_PREFIXES = ['audio/'];

/**
 * 실제 업로드된 음성(`multipart/form-data`)을 받아 전사한다 (PRD §11.1/§12). 원본 오디오는 전사
 * 직후 폐기하며 어떤 저장소에도 쓰지 않는다 — 이 핸들러가 유지하는 것은 요청 처리 중의 메모리
 * 버퍼뿐이고 응답 후 즉시 GC 대상이 된다.
 */
export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 계정만 음성을 입력할 수 있어요.' }, { status: 403 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: '오디오 파일을 읽을 수 없어요. 다시 시도해 주세요.' }, { status: 400 });
  }

  const file = form.get('audio');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: '오디오 파일이 필요해요.' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: '녹음된 소리가 없어요. 다시 말씀해 주세요.' }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: '음성이 너무 길어요. 60초 이내로 다시 말씀해 주세요.' }, { status: 413 });
  }
  const mimeType = file.type || 'audio/webm';
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return NextResponse.json({ error: '지원하지 않는 오디오 형식이에요.' }, { status: 415 });
  }

  const { port: ai, provider } = selectAiPort();
  const audioBuffer = await file.arrayBuffer();
  try {
    const result = await ai.transcribe(audioBuffer, mimeType);
    return NextResponse.json({ transcript: result.transcript, is_demo: provider === 'fixture', notice: '실제 음성 원본은 전사 직후 폐기하고 보관하지 않아요.' });
  } catch {
    // 전사 실패에도 화면 흐름 자체는 끊기지 않아야 한다 — 클라이언트는 텍스트 직접 입력으로 폴백한다.
    return NextResponse.json({ error: '지금은 음성을 알아듣지 못했어요. 텍스트로 입력해 주세요.' }, { status: 502 });
  }
  // audioBuffer는 함수 스코프를 벗어나며 어떤 저장소에도 쓰지 않았다 — 원본 미보관 원칙(PRD §11.1).
}
