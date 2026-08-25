'use client';
import type { ServiceRequestView as ServiceRequest } from '@/lib/domain/types';
import type { RealtimeClientEvent, RealtimeClientPort, RealtimeConnectionState } from './realtimePort';

type StreamMessage =
  | { resource: 'ready' }
  | { resource: 'service_request'; type: 'insert' | 'update'; request: ServiceRequest }
  | { resource: 'service_request'; type: 'delete'; id: string; deletedAt: string }
  | { resource: 'emergency'; type: 'insert' | 'update' | 'delete'; id: string };

/** 서버가 권한·redaction을 적용한 Supabase 변경 신호만 받는다. */
export class SseRealtimeClient implements RealtimeClientPort {
  private listeners = new Set<(event: RealtimeClientEvent) => void>();
  private connectionListeners = new Set<(state: RealtimeConnectionState) => void>();
  private state: RealtimeConnectionState = 'disconnected';
  private source: EventSource | null = null;

  static create(url = '/api/care-events'): SseRealtimeClient | null {
    return typeof EventSource === 'undefined' ? null : new SseRealtimeClient(url);
  }

  constructor(url: string) {
    this.source = new EventSource(url);
    this.source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as StreamMessage;
        if (event.resource === 'ready') { this.setState('connected'); return; }
        if (event.resource === 'emergency') {
          window.dispatchEvent(new CustomEvent('dolbom:emergency-change', { detail: event }));
          return;
        }
        if (event.type === 'delete') this.emit({ type: 'delete', id: event.id, deletedAt: event.deletedAt });
        else this.emit({ type: event.type, request: event.request });
      } catch { /* 잘못된 단일 이벤트는 다음 정상 이벤트 수신을 막지 않는다. */ }
    };
    this.source.onerror = () => this.setState('disconnected');
  }

  private emit(event: RealtimeClientEvent) { for (const listener of this.listeners) listener(event); }
  private setState(state: RealtimeConnectionState) {
    if (this.state === state) return;
    this.state = state;
    window.dispatchEvent(new CustomEvent('dolbom:realtime-state', { detail: state }));
    for (const listener of this.connectionListeners) listener(state);
  }
  subscribe(listener: (event: RealtimeClientEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onConnectionChange(listener: (state: RealtimeConnectionState) => void): () => void { this.connectionListeners.add(listener); return () => this.connectionListeners.delete(listener); }
  connectionState(): RealtimeConnectionState { return this.state; }
  dispose(): void { this.source?.close(); this.source = null; this.listeners.clear(); this.connectionListeners.clear(); }
}
