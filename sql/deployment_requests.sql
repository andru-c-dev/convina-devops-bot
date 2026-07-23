-- Run this in Supabase → SQL Editor → New query
-- Safe to choose "Enable RLS" / run with RLS when prompted.
-- Prefer running sql/apps.sql first, then this file, on fresh setups.
-- For existing projects, use the migrate_*.sql files instead.

create extension if not exists "pgcrypto";

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deployment_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigserial,
  app_id uuid references public.apps (id),
  service text,
  environment text not null check (environment in ('staging', 'production')),
  batch_start date not null,
  batch_end date not null,
  description text,
  requested_by text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'deployed', 'cancelled', 'completed')),
  channel_id text,
  message_ts text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deployment_requests_batch_range_check check (batch_end >= batch_start)
);

create index if not exists apps_name_idx on public.apps (name);
create index if not exists deployment_requests_status_idx
  on public.deployment_requests (status);
create index if not exists deployment_requests_requested_by_idx
  on public.deployment_requests (requested_by);
create index if not exists deployment_requests_batch_start_idx
  on public.deployment_requests (batch_start);
create index if not exists deployment_requests_app_id_idx
  on public.deployment_requests (app_id);

comment on column public.deployment_requests.ticket_number is
  'Human-friendly sequential number used as DEP-<n>';

alter table public.apps enable row level security;
alter table public.deployment_requests enable row level security;
