import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('0004 service-request delete migration', () => {
  it('drops the existing delete policy before recreating it so the migration can be rerun', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/0004_service_request_delete.sql'), 'utf8');
    const dropPolicy = 'drop policy if exists service_requests_delete_assigned_worker on public.service_requests;';
    const createPolicy = 'create policy service_requests_delete_assigned_worker on public.service_requests';

    expect(sql).toContain(dropPolicy);
    expect(sql.indexOf(dropPolicy)).toBeLessThan(sql.indexOf(createPolicy));
  });
});
