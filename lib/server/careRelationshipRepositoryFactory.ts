import { createClient } from '@supabase/supabase-js';
import { InMemoryCareRelationshipRepository, type CareRelationshipRepository } from './careRelationshipRepository';
import { SupabaseCareRelationshipRepository } from './supabaseCareRelationshipRepository';

export function selectCareRelationshipRepository(env: Record<string, string | undefined> = process.env): { repository: CareRelationshipRepository; provider: 'supabase' | 'in-memory' } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { repository: new InMemoryCareRelationshipRepository(), provider: 'in-memory' };
  return { repository: new SupabaseCareRelationshipRepository(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })), provider: 'supabase' };
}
