import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { authenticatedActor, type AuthActor } from '@/lib/server/auth';
import { getVisibleRequest } from '@/lib/server/serviceRequestVisibility';
import { careRelationships, emergencyEvents } from '@/lib/server/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();
const encode = (value: unknown) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);

/**
 * 담당 관계 조회를 연결 단위로 잠깐 캐시한다. 이벤트마다 DB를 다시 읽으면 변경이 몰릴 때
 * 연결당 쿼리가 선형으로 늘어난다. 연결 해제는 이 TTL 안에 반영되고, 실제 데이터 접근은
 * API와 RLS가 매번 다시 검사하므로 이 캐시가 권한 판정의 최종 근거는 아니다.
 */
const RELATIONSHIP_CACHE_TTL_MS = 5000;

function createSeniorScope(actor: AuthActor) {
  let cached: { ids: string[]; at: number } | null = null;
  return async function canSeeSenior(seniorId?: string): Promise<boolean> {
    if (!seniorId) return false;
    if (actor.role === 'senior') return actor.id === seniorId;
    if (!cached || Date.now() - cached.at > RELATIONSHIP_CACHE_TTL_MS) {
      cached = { ids: await careRelationships.seniorIdsForMember(actor.id, actor.role), at: Date.now() };
    }
    return cached.ids.includes(seniorId);
  };
}

/** Supabase 변경을 역할별 안전 이벤트로 바꿔 전달한다. 원본 테이블 payload는 브라우저에 노출하지 않는다. */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response('Realtime unavailable', { status: 503 });
  const actor = await authenticatedActor(request);
  if (!actor) return new Response('Authentication required', { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const canSeeSenior = createSeniorScope(actor);
  let channel: RealtimeChannel | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  // 구독 해제·타이머 정리는 abort와 cancel 어느 경로로 끝나든 똑같이 한 번만 수행한다.
  let releaseResources = () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (channel) void client.removeChannel(channel);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value: unknown) => { if (!closed) controller.enqueue(encode(value)); };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (channel) void client.removeChannel(channel);
        try { controller.close(); } catch { /* 이미 닫힌 스트림 */ }
      };
      releaseResources = cleanup;

      channel = client.channel(`care-events:${actor.role}:${actor.id}:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, async (payload) => {
          const changed = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { id?: string; senior_id?: string };
          if (!changed.id) return;
          if (payload.eventType === 'DELETE') {
            if (await canSeeSenior(changed.senior_id)) send({ resource: 'service_request', type: 'delete', id: changed.id, deletedAt: new Date().toISOString() });
            return;
          }
          const visible = await getVisibleRequest(actor, changed.id);
          if (visible) send({ resource: 'service_request', type: payload.eventType === 'INSERT' ? 'insert' : 'update', request: visible });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_events' }, async (payload) => {
          const changed = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { id?: string; senior_id?: string };
          if (!changed.id || !(await canSeeSenior(changed.senior_id))) return;
          if (payload.eventType !== 'DELETE' && !(await emergencyEvents.get(changed.id))) return;
          send({ resource: 'emergency', type: payload.eventType.toLowerCase(), id: changed.id });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') send({ resource: 'ready' });
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') cleanup();
        });

      heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(': keepalive\n\n')); }, 15000);
      request.signal.addEventListener('abort', cleanup, { once: true });
    },
    cancel() {
      releaseResources();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
