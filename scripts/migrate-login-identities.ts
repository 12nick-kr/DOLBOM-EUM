import { createClient } from '@supabase/supabase-js';
import { roleSchema } from '../lib/domain/types';
import { buildLoginIdentityUpdate, maskLoginId } from '../lib/server/loginIdentityMigration';

const apply = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY가 필요합니다.');

const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: profiles, error } = await client.from('profiles').select('id, login_id, role').not('login_id', 'is', null);
if (error) throw new Error(error.message);

let changed = 0;
let skipped = 0;
for (const row of profiles ?? []) {
  const role = roleSchema.safeParse(row.role);
  if (!row.login_id || !role.success) { skipped += 1; continue; }
  const { data: authData, error: authError } = await client.auth.admin.getUserById(row.id as string);
  if (authError || !authData.user) {
    console.warn(`[건너뜀] ${maskLoginId(row.login_id as string)}: 연결된 Auth 사용자가 없습니다.`);
    skipped += 1;
    continue;
  }

  const update = buildLoginIdentityUpdate({ id: row.id as string, loginId: row.login_id as string, role: role.data }, authData.user.app_metadata);
  if (authData.user.email === update.email && authData.user.app_metadata.auth_method === 'login_id') {
    console.log(`[완료됨] ${maskLoginId(row.login_id as string)}`);
    skipped += 1;
    continue;
  }
  if (!apply) {
    console.log(`[dry-run] ${maskLoginId(row.login_id as string)} 계정을 Email/Password 식별자로 전환합니다.`);
    changed += 1;
    continue;
  }

  const { error: updateError } = await client.auth.admin.updateUserById(row.id as string, update);
  if (updateError) throw new Error(`${maskLoginId(row.login_id as string)} 전환 실패: ${updateError.message}`);
  console.log(`[적용] ${maskLoginId(row.login_id as string)} 전환 완료`);
  changed += 1;
}

console.log(`${apply ? '적용' : 'dry-run'} 종료: 변경 대상 ${changed}개, 건너뜀 ${skipped}개`);
if (!apply) console.log('확인 후 같은 명령 끝에 --apply를 붙여 실제 적용하세요.');
