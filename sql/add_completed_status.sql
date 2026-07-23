-- Run in Supabase SQL Editor to allow status = 'completed'

alter table public.deployment_requests
  drop constraint if exists deployment_requests_status_check;

alter table public.deployment_requests
  add constraint deployment_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'deployed', 'cancelled', 'completed'));
