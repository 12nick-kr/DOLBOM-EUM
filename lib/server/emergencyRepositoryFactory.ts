import { createClient } from '@supabase/supabase-js';
import type { EmergencyEvent } from '@/lib/domain/types';
import { InMemoryEmergencyRepository, type EmergencyRepository } from './emergencyRepository';
import { SupabaseEmergencyRepository } from './supabaseEmergencyRepository';

export function selectEmergencyRepository(env: Record<string, string | undefined> = process.env, seed: EmergencyEvent[] = []): { repository: EmergencyRepository; provider: 'supabase' | 'in-memory' } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { repository: new InMemoryEmergencyRepository(seed), provider: 'in-memory' };
  return { repository: new SupabaseEmergencyRepository(createClient(url, key)), provider: 'supabase' };
}
