'use client';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { ServiceRequest } from '@/lib/domain/types';
import type { RealtimeClientEvent, RealtimeClientPort, RealtimeConnectionState } from './realtimePort';

/**
 * 로그인된 Supabase 사용자 JWT로 service_requests postgres_changes를 구독한다. payload를 그대로
 * 화면에 넣지 않고 역할 범위가 적용된 서버 카드 피드를 재조회해 원문 redaction을 보존한다.
 */
export class SupabaseRealtimeClient implements RealtimeClientPort {
  private listeners = new Set<(event: RealtimeClientEvent) => void>();
  private connectionListeners = new Set<(state: RealtimeConnectionState) => void>();
  private state: RealtimeConnectionState = 'disconnected';
  private channel: RealtimeChannel | null = null;
  private disposed = false;

  constructor(private client: SupabaseClient, private fetchList: () => Promise<ServiceRequest[]>) {
    void this.connect();
  }

  static fromEnvironment(fetchList: () => Promise<ServiceRequest[]>): SupabaseRealtimeClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    return new SupabaseRealtimeClient(createClient(url, key), fetchList);
  }

  private async connect() {
    const { data } = await this.client.auth.getSession();
    if (this.disposed || !data.session?.access_token) return;
    this.client.realtime.setAuth(data.session.access_token);
    this.channel = this.client
      .channel(`care-cards:${data.session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, (payload) => {
        const changed = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as { id?: string };
        if (!changed.id) return;
        void this.fetchList().then((rows) => {
          const request = rows.find((row) => row.id === changed.id);
          if (request) this.emit({ type: payload.eventType === 'INSERT' ? 'insert' : 'update', request });
        }).catch(() => this.setState('disconnected'));
      })
      .subscribe((status) => this.setState(status === 'SUBSCRIBED' ? 'connected' : 'disconnected'));
  }

  private emit(event: RealtimeClientEvent) { for (const listener of this.listeners) listener(event); }
  private setState(state: RealtimeConnectionState) {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.connectionListeners) listener(state);
  }
  subscribe(listener: (event: RealtimeClientEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onConnectionChange(listener: (state: RealtimeConnectionState) => void): () => void { this.connectionListeners.add(listener); return () => this.connectionListeners.delete(listener); }
  connectionState(): RealtimeConnectionState { return this.state; }
  dispose(): void {
    this.disposed = true;
    if (this.channel) void this.client.removeChannel(this.channel);
    this.listeners.clear();
    this.connectionListeners.clear();
  }
}
