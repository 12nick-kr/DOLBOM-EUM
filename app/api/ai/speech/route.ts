import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { selectAiPort } from '@/lib/server/aiFactory';
import { state } from '@/lib/server/store';
import { verifyAssistantTurnToken } from '@/lib/server/assistantTurnToken';
import { authenticatedActor } from '@/lib/server/auth';

/** PRD FR-07: 서버 TTS가 5초 안에 시작하지 못하면 브라우저 TTS로 폴백한다. */
const TTS_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('tts_timeout')), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * 클라이언트가 보낸 임의 텍스트가 아니라 권한이 검증된 `assistant_turn_id`만 음성으로 변환한다
 * (PRD §12/TDD §3.7). 조회는 여전히 `state.turns`(서버 정본)에서 하며, 실제 합성만 선택된
 * `AiPort`에 위임한다.
 */
export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 계정만 음성 답변을 들을 수 있어요.' }, { status: 403 });
  const data = z.object({ assistant_turn_id: z.string(), senior_id: z.string().optional(), speech_token: z.string().optional() }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: 'assistant_turn_id가 필요해요.' }, { status: 400 });
  const verified = data.data.speech_token
    ? verifyAssistantTurnToken(data.data.speech_token, { id: data.data.assistant_turn_id, seniorId: actor.id })
    : null;
  const storedTurn = state.turns.find((item) => item.id === data.data.assistant_turn_id && item.seniorId === actor.id);
  const turnText = verified?.text ?? storedTurn?.assistant_text;
  if (!turnText) return NextResponse.json({ error: '권한이 없거나 답변을 찾을 수 없어요.' }, { status: 403 });

  const { port: ai, provider } = selectAiPort();

  if (provider === 'fixture') {
    return NextResponse.json({ assistant_turn_id: data.data.assistant_turn_id, speech_status: 'browser_fallback', text: turnText }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    const result = await withTimeout(ai.speech(turnText), TTS_TIMEOUT_MS);
    if (!result.audio) {
      return NextResponse.json({ assistant_turn_id: data.data.assistant_turn_id, speech_status: 'browser_fallback', text: turnText }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    return new NextResponse(result.audio, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'private, no-store',
        'X-Assistant-Turn-Id': data.data.assistant_turn_id,
        'X-Speech-Status': 'completed',
      },
    });
  } catch {
    // 5초 타임아웃 또는 실제 호출 실패 — 브라우저 speechSynthesis 폴백으로 텍스트와 상태를 반환한다.
    return NextResponse.json({ assistant_turn_id: data.data.assistant_turn_id, speech_status: 'browser_fallback', text: turnText }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
