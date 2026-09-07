-- Adds a free-text description admins can set for their chapter (e.g. a
-- blurb about the chapter shown alongside its name/school). Paste into the
-- Supabase SQL Editor and run once. Safe to re-run.

alter table public.groups add column if not exists description text not null default '';
