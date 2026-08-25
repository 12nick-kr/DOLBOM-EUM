import type { EmergencyEvent, Role } from '@/lib/domain/types';

export type CreateEmergencyInput = { seniorId: string; utterance: string; location: string };
export type EmergencyCloseReason = 'senior_cancelled' | 'resolved' | 'false_alarm';
export type UpdateEmergencyInput = { status: EmergencyEvent['status']; actor: Role; actorId: string; action: string; closeReason?: EmergencyCloseReason };

export interface EmergencyRepository {
  list(): Promise<EmergencyEvent[]>;
  get(id: string): Promise<EmergencyEvent | undefined>;
  create(input: CreateEmergencyInput): Promise<EmergencyEvent>;
  update(id: string, input: UpdateEmergencyInput): Promise<EmergencyEvent>;
}

export class InMemoryEmergencyRepository implements EmergencyRepository {
  constructor(private rows: EmergencyEvent[] = []) {}
  async list() { return [...this.rows]; }
  async get(id: string) { return this.rows.find((row) => row.id === id); }
  async create(input: CreateEmergencyInput) {
    const now = new Date().toISOString();
    const event: EmergencyEvent = { id: `emergency-${crypto.randomUUID()}`, seniorId: input.seniorId, utterance: input.utterance, location: input.location, level: 'emergency', status: 'detected', createdAt: now, actions: [{ actor: 'senior', action: '알림 초안 확인', result: '가족·복지사 앱 내 알림 생성', at: now }] };
    this.rows.unshift(event);
    return event;
  }
  async update(id: string, input: UpdateEmergencyInput) {
    const event = await this.get(id);
    if (!event) throw new Error('알림을 찾을 수 없습니다.');
    event.status = input.status;
    event.actions.push({ actor: input.actor, action: input.action, result: '앱 내 처리 상태 반영', at: new Date().toISOString() });
    return event;
  }
}
