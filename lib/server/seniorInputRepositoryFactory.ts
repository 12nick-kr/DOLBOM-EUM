import { createClient } from '@supabase/supabase-js';
import { InMemorySeniorInputRepository, type SeniorInputRepository } from './seniorInputRepository';
import { SupabaseSeniorInputRepository } from './supabaseSeniorInputRepository';

export function selectSeniorInputRepository(env: Record<string, string | undefined> = process.env): { repository: SeniorInputRepository; provider: 'supabase' | 'in-memory' } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { repository: new InMemorySeniorInputRepository(), provider: 'in-memory' };
  return { repository: new SupabaseSeniorInputRepository(createClient(url, key)), provider: 'supabase' };
}
