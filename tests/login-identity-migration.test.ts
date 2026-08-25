import { describe, expect, it } from 'vitest';
import { buildLoginIdentityUpdate, maskLoginId } from '@/lib/server/loginIdentityMigration';

describe('existing Auth identity migration', () => {
  it('preserves existing server metadata while enforcing role and login-id auth claims', () => {
    const update = buildLoginIdentityUpdate(
      { id: 'user-1', loginId: '010-0000-4321', role: 'worker' },
      { existing: 'kept', role: 'family' },
    );
    expect(update).toEqual({
      email: '01000004321@id.dolbomeum.invalid',
      email_confirm: true,
      app_metadata: { existing: 'kept', role: 'worker', demo_account: true, auth_method: 'login_id' },
    });
  });

  it('masks the login id in migration logs', () => {
    expect(maskLoginId('01000004321')).toBe('010-****-4321');
  });
});
