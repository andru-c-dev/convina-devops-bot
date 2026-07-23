-- Run in Supabase SQL Editor to migrate existing `batch` text → date columns.
-- Safe for tables that already have ticket rows with free-text batch values.

alter table public.deployment_requests
  add column if not exists batch_start date,
  add column if not exists batch_end date;

-- Existing rows: leave dates null for now (old free-text batches can't be parsed reliably).
-- New tickets will populate batch_start / batch_end.

alter table public.deployment_requests
  alter column batch drop not null;

-- Optional: drop old text column after you're comfortable
-- alter table public.deployment_requests drop column if exists batch;

-- Enforce range when both dates are present
alter table public.deployment_requests
  drop constraint if exists deployment_requests_batch_range_check;

alter table public.deployment_requests
  add constraint deployment_requests_batch_range_check
  check (
    batch_start is null
    or batch_end is null
    or batch_end >= batch_start
  );

create index if not exists deployment_requests_batch_start_idx
  on public.deployment_requests (batch_start);
