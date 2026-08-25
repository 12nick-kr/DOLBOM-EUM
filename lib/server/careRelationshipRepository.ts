import type { Role } from '@/lib/domain/types';
import { getDemoAccountById, listDemoAccounts } from './accountStore';
import { demoFamilyId, demoSeniorId, demoWorkerId } from './storeIds';

export type CareProfile = { id: string; role: Role; displayName: string; loginId: string | null };
export type CareRelationship = {
  seniorId: string;
  memberId: string;
  relationshipType: 'family' | 'worker';
  status: 'active' | 'revoked';
  linkedBy: string;
  createdAt: string;
  endsAt: string | null;
};
export type CareGroupSummary = { id: string; senior: CareProfile; workers: CareProfile[]; family: CareProfile[] };

export interface CareRelationshipRepository {
  findProfileByLoginId(loginId: string): Promise<CareProfile | undefined>;
  getProfile(id: string): Promise<CareProfile | undefined>;
  seniorIdsForMember(memberId: string, relationshipType?: 'family' | 'worker'): Promise<string[]>;
  groupsForWorker(workerId: string): Promise<CareGroupSummary[]>;
  link(input: { actorId: string; seniorId: string; memberId: string; relationshipType: 'family' | 'worker' }): Promise<CareRelationship>;
  unlink(input: { actorId: string; seniorId: string; memberId: string }): Promise<void>;
}

const seededProfiles: CareProfile[] = [
  { id: demoSeniorId, role: 'senior', displayName: '김순자', loginId: '01000000001' },
  { id: demoFamilyId, role: 'family', displayName: '이지현', loginId: '01000000002' },
  { id: demoWorkerId, role: 'worker', displayName: '박사회복지사', loginId: '01000000003' },
];

type CareRuntime = typeof globalThis & {
  __dolbomCareRelationshipRows?: CareRelationship[];
  __dolbomCareGroupIds?: Map<string, string>;
};

export class InMemoryCareRelationshipRepository implements CareRelationshipRepository {
  private rows: CareRelationship[];
  private groupIds: Map<string, string>;

  constructor() {
    const runtime = globalThis as CareRuntime;
    this.rows = runtime.__dolbomCareRelationshipRows ?? [
      { seniorId: demoSeniorId, memberId: demoWorkerId, relationshipType: 'worker', status: 'active', linkedBy: demoWorkerId, createdAt: new Date().toISOString(), endsAt: null },
      { seniorId: demoSeniorId, memberId: demoFamilyId, relationshipType: 'family', status: 'active', linkedBy: demoWorkerId, createdAt: new Date().toISOString(), endsAt: null },
    ];
    this.groupIds = runtime.__dolbomCareGroupIds ?? new Map([[demoSeniorId, 'care-group-demo-001']]);
    runtime.__dolbomCareRelationshipRows = this.rows;
    runtime.__dolbomCareGroupIds = this.groupIds;
  }

  async findProfileByLoginId(loginId: string) {
    const profile = seededProfiles.find((item) => item.loginId === loginId);
    if (profile) return profile;
    const account = listDemoAccounts().find((item) => item.loginId === loginId);
    return account ? { id: account.id, role: account.role, displayName: account.displayName, loginId: account.loginId } : undefined;
  }

  async getProfile(id: string) {
    const profile = seededProfiles.find((item) => item.id === id);
    if (profile) return profile;
    const account = getDemoAccountById(id);
    return account ? { id: account.id, role: account.role, displayName: account.displayName, loginId: account.loginId } : undefined;
  }

  async seniorIdsForMember(memberId: string, relationshipType?: 'family' | 'worker') {
    return this.rows.filter((row) => row.memberId === memberId && row.status === 'active' && (!relationshipType || row.relationshipType === relationshipType)).map((row) => row.seniorId);
  }

  async groupsForWorker(workerId: string) {
    const seniorIds = await this.seniorIdsForMember(workerId, 'worker');
    const groups: CareGroupSummary[] = [];
    for (const seniorId of seniorIds) {
      const senior = await this.getProfile(seniorId);
      if (!senior) continue;
      const active = this.rows.filter((row) => row.seniorId === seniorId && row.status === 'active');
      const workers = (await Promise.all(active.filter((row) => row.relationshipType === 'worker').map((row) => this.getProfile(row.memberId)))).filter(Boolean) as CareProfile[];
      const family = (await Promise.all(active.filter((row) => row.relationshipType === 'family').map((row) => this.getProfile(row.memberId)))).filter(Boolean) as CareProfile[];
      groups.push({ id: this.groupIds.get(seniorId) ?? `care-group-${seniorId}`, senior, workers, family });
    }
    return groups;
  }

  async link(input: { actorId: string; seniorId: string; memberId: string; relationshipType: 'family' | 'worker' }) {
    const senior = await this.getProfile(input.seniorId);
    const member = await this.getProfile(input.memberId);
    if (senior?.role !== 'senior' || member?.role !== input.relationshipType) throw new Error('계정 역할이 연결 유형과 맞지 않아요.');
    if (input.relationshipType === 'worker' && input.actorId !== input.memberId) throw new Error('자신을 담당 사회복지사로만 연결할 수 있어요.');
    if (input.relationshipType === 'family' && !(await this.seniorIdsForMember(input.actorId, 'worker')).includes(input.seniorId)) throw new Error('담당 노인의 가족만 연결할 수 있어요.');
    const existing = this.rows.find((row) => row.seniorId === input.seniorId && row.memberId === input.memberId);
    if (existing) {
      existing.status = 'active';
      existing.endsAt = null;
      existing.linkedBy = input.actorId;
      return existing;
    }
    const relationship: CareRelationship = { ...input, status: 'active', linkedBy: input.actorId, createdAt: new Date().toISOString(), endsAt: null };
    this.rows.push(relationship);
    if (!this.groupIds.has(input.seniorId)) this.groupIds.set(input.seniorId, `care-group-${crypto.randomUUID()}`);
    return relationship;
  }

  async unlink(input: { actorId: string; seniorId: string; memberId: string }) {
    if (!(await this.seniorIdsForMember(input.actorId, 'worker')).includes(input.seniorId)) throw new Error('담당 노인의 연결만 해제할 수 있어요.');
    const relationship = this.rows.find((row) => row.seniorId === input.seniorId && row.memberId === input.memberId && row.status === 'active');
    if (!relationship) throw new Error('활성 연결을 찾을 수 없어요.');
    relationship.status = 'revoked';
    relationship.endsAt = new Date().toISOString();
  }
}
