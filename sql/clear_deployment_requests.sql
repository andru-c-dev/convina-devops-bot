-- Clear all deployment request tickets (keeps the `apps` table intact).
-- Run in Supabase → SQL Editor → New query

-- Remove all tickets
truncate table public.deployment_requests restart identity cascade;

-- Optional: if you also want to wipe apps, uncomment below
-- truncate table public.apps restart identity cascade;
