-- Run in Supabase → SQL Editor
-- Creates the Apps lookup table used by the App/Service dropdown.

create extension if not exists "pgcrypto";

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apps_name_idx on public.apps (name);

alter table public.apps enable row level security;

-- Seed example apps (edit/delete as needed)
insert into public.apps (name)
values
  ('Medsafe'),
  ('API'),
  ('Frontend'),
  ('Worker')
on conflict (name) do nothing;
