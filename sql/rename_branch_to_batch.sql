-- Run this in Supabase → SQL Editor if the table already exists with a `branch` column

alter table public.deployment_requests
  rename column branch to batch;
