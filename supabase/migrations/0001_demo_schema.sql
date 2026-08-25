-- Reference migration: execute only after the project owner explicitly approves a real Supabase migration.
-- All UI tests use the in-memory fake repository; no remote service is contacted by this repository.
create type public.app_role as enum ('senior', 'family', 'worker');
create table public.profiles (id uuid primary key, role public.app_role not null, display_name text not null, accessibility_preferences jsonb not null default '{}'::jsonb);
create table public.care_relationships (senior_id uuid not null, member_id uuid not null, relationship_type text not null, status text not null default 'active', starts_at timestamptz not null default now(), ends_at timestamptz, primary key (senior_id, member_id));
create table public.consent_grants (id uuid primary key default gen_random_uuid(), senior_id uuid not null, grantee_id uuid not null, scope text not null, purpose text not null, expires_at timestamptz, revoked_at timestamptz);
create table public.service_requests (id uuid primary key default gen_random_uuid(), senior_id uuid not null, type text not null, details jsonb not null, status text not null, assignee_id uuid, due_at timestamptz, created_at timestamptz not null default now());
create table public.emergency_events (id uuid primary key default gen_random_uuid(), senior_id uuid not null, level text not null, utterance text, location jsonb, status text not null, created_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, resource_type text not null, resource_id uuid, reason text, created_at timestamptz not null default now());
alter table public.profiles enable row level security; alter table public.care_relationships enable row level security; alter table public.consent_grants enable row level security; alter table public.service_requests enable row level security; alter table public.emergency_events enable row level security;
-- Active relationship + unrevoked/unexpired scoped consent must be checked in each production SELECT policy.
-- Keep authority-documents in a private bucket; object paths are generated UUIDs and never include personal names.
