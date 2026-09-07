-- Private notes a Big/Little can keep on people they're getting to know
-- before ranking — multiple dated entries per person, since you'll likely
-- have several interactions with someone before you rank them. Deliberately
-- private: only the author can ever read their own notes (not the subject,
-- not admins) — this is a personal memory aid, not a shared or aggregated
-- rating system. Paste into the Supabase SQL Editor and run once. Safe to
-- re-run.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  event_date date,
  comment text not null default '',
  -- "Would you want to meet again?" reads far more like a real reflection
  -- than a 1-5 star score, and stays optional — some notes are just a
  -- comment with no verdict attached yet.
  interest text check (interest in ('definitely', 'would_like_to', 'maybe', 'probably_not')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "notes: author manages own" on public.notes;
create policy "notes: author manages own"
  on public.notes for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create index if not exists notes_author_group_idx on public.notes (author_id, group_id);
