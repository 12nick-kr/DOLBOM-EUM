import type { SupabaseClient } from '@supabase/supabase-js';
import type { CareGroupSummary, CareProfile, CareRelationship, CareRelationshipRepository } from './careRelationshipRepository';

type ProfileRow = { id: string; role: 'senior' | 'family' | 'worker'; display_name: string; login_id: string | null };
type RelationshipRow = { senior_id: string; member_id: string; relationship_type: 'family' | 'worker'; status: 'active' | 'revoked'; linked_by: string | null; starts_at: string; ends_at: string | null };

const mapProfile = (row: ProfileRow): CareProfile => ({ id: row.id, role: row.role, displayName: row.display_name, loginId: row.login_id });
const mapRelationship = (row: RelationshipRow): CareRelationship => ({ seniorId: row.senior_id, memberId: row.member_id, relationshipType: row.relationship_type, status: row.status, linkedBy: row.linked_by ?? row.member_id, createdAt: row.starts_at, endsAt: row.ends_at });

export class SupabaseCareRelationshipRepository implements CareRelationshipRepository {
  constructor(private client: SupabaseClient) {}

  async findProfileByLoginId(loginId: string) {
    const { data, error } = await this.client.from('profiles').select('id, role, display_name, login_id').eq('login_id', loginId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapProfile(data as ProfileRow) : undefined;
  }

  async getProfile(id: string) {
    const { data, error } = await this.client.from('profiles').select('id, role, display_name, login_id').eq('id', id).maybeSingle();
    if (!error) return data ? mapProfile(data as ProfileRow) : undefined;
    // 이전 배포에서 login_id 마이그레이션이 누락되어도 담당 그룹 자체가 빈 화면이 되지 않게 한다.
    if (error.code === '42703') {
      const fallback = await this.client.from('profiles').select('id, role, display_name').eq('id', id).maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      return fallback.data ? mapProfile({ ...(fallback.data as Omit<ProfileRow, 'login_id'>), login_id: null }) : undefined;
    }
    throw new Error(error.message);
  }

  async seniorIdsForMember(memberId: string, relationshipType?: 'family' | 'worker') {
    let query = this.client.from('care_relationships').select('senior_id').eq('member_id', memberId).eq('status', 'active').or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`);
    if (relationshipType) query = query.eq('relationship_type', relationshipType);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.senior_id as string);
  }

  async groupsForWorker(workerId: string) {
    const seniorIds = await this.seniorIdsForMember(workerId, 'worker');
    const groups: CareGroupSummary[] = [];
    for (const seniorId of seniorIds) {
      const senior = await this.getProfile(seniorId);
      if (!senior) continue;
      const { data: group } = await this.client.from('care_groups').select('id').eq('senior_id', seniorId).maybeSingle();
      const { data: rows, error } = await this.client.from('care_relationships').select('member_id, relationship_type').eq('senior_id', seniorId).eq('status', 'active').or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`);
      if (error) throw new Error(error.message);
      const profiles = (await Promise.all((rows ?? []).map((row) => this.getProfile(row.member_id as string)))).filter(Boolean) as CareProfile[];
      const workerIds = new Set((rows ?? []).filter((row) => row.relationship_type === 'worker').map((row) => row.member_id));
      const familyIds = new Set((rows ?? []).filter((row) => row.relationship_type === 'family').map((row) => row.member_id));
      groups.push({ id: group?.id ?? seniorId, senior, workers: profiles.filter((profile) => workerIds.has(profile.id)), family: profiles.filter((profile) => familyIds.has(profile.id)) });
    }
    return groups;
  }

  async link(input: { actorId: string; seniorId: string; memberId: string; relationshipType: 'family' | 'worker' }) {
    const senior = await this.getProfile(input.seniorId);
    const member = await this.getProfile(input.memberId);
    if (senior?.role !== 'senior' || member?.role !== input.relationshipType) throw new Error('계정 역할이 연결 유형과 맞지 않아요.');
    if (input.relationshipType === 'worker' && input.actorId !== input.memberId) throw new Error('자신을 담당 사회복지사로만 연결할 수 있어요.');
    if (input.relationshipType === 'family' && !(await this.seniorIdsForMember(input.actorId, 'worker')).includes(input.seniorId)) throw new Error('담당 노인의 가족만 연결할 수 있어요.');

    const { data: group, error: groupError } = await this.client.from('care_groups').upsert({ senior_id: input.seniorId, status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'senior_id' }).select('id').single();
    if (groupError) throw new Error(groupError.message);
    const { data, error } = await this.client.from('care_relationships').upsert({
      care_group_id: group.id,
      senior_id: input.seniorId,
      member_id: input.memberId,
      relationship_type: input.relationshipType,
      status: 'active',
      linked_by: input.actorId,
      ends_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'senior_id,member_id' }).select('senior_id, member_id, relationship_type, status, linked_by, starts_at, ends_at').single();
    if (error) throw new Error(error.message);
    await this.client.from('audit_logs').insert({ actor_id: input.actorId, action: 'care_relationship.linked', resource_type: 'care_relationship', resource_id: group.id, reason: `${input.relationshipType} 계정 연결` });
    return mapRelationship(data as RelationshipRow);
  }

  async unlink(input: { actorId: string; seniorId: string; memberId: string }) {
    if (!(await this.seniorIdsForMember(input.actorId, 'worker')).includes(input.seniorId)) throw new Error('담당 노인의 연결만 해제할 수 있어요.');
    const { error } = await this.client.from('care_relationships').update({ status: 'revoked', ends_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('senior_id', input.seniorId).eq('member_id', input.memberId).eq('status', 'active');
    if (error) throw new Error(error.message);
    await this.client.from('audit_logs').insert({ actor_id: input.actorId, action: 'care_relationship.revoked', resource_type: 'care_relationship', reason: `${input.seniorId}:${input.memberId}` });
  }
}
