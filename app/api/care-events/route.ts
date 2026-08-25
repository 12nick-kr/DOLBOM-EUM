import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { demoActor } from '@/lib/server/auth';
import { getVisibleRequest } from '@/lib/server/serviceRequestVisibility';
import { demoSeniorId, emergencyEvents, seniorIdsAssignedTo } from '@/lib/server/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();
const encode = (value: unknown) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);

function canSeeSenior(actor: ReturnType<typeof demoActor>, seniorId?: string): boolean {
  if (!seniorId) return false;
  if (actor.role === 'senior') return actor.id === seniorId;
  if (actor.role === 'worker') return seniorIdsAssignedTo(actor.id).includes(seniorId);
  return seniorId === demoSeniorId;
}

/** Supabase 변경을 역할별 안전 이벤트로 바꿔 전달한다. 원본 테이블 payload는 브라우저에 노출하지 않는다. */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response('Realtime unavailable', { status: 503 });
  const actor = demoActor(request);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let channel: RealtimeChannel | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

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

      channel = client.channel(`care-events:${actor.role}:${actor.id}:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, async (payload) => {
          const changed = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { id?: string; senior_id?: string };
          if (!changed.id) return;
          if (payload.eventType === 'DELETE') {
            if (canSeeSenior(actor, changed.senior_id)) send({ resource: 'service_request', type: 'delete', id: changed.id, deletedAt: new Date().toISOString() });
            return;
          }
          const visible = await getVisibleRequest(actor, changed.id);
          if (visible) send({ resource: 'service_request', type: payload.eventType === 'INSERT' ? 'insert' : 'update', request: visible });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_events' }, async (payload) => {
          const changed = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { id?: string; senior_id?: string };
          if (!changed.id || !canSeeSenior(actor, changed.senior_id)) return;
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
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (channel) void client.removeChannel(channel);
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
