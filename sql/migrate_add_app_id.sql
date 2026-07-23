-- Run in Supabase → SQL Editor after creating public.apps
-- Links deployment_requests to apps via app_id

alter table public.deployment_requests
  add column if not exists app_id uuid references public.apps (id);

-- Keep legacy `service` text for older rows / display fallback, but allow null for new rows
alter table public.deployment_requests
  alter column service drop not null;

create index if not exists deployment_requests_app_id_idx
  on public.deployment_requests (app_id);
