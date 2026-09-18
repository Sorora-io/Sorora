-- Per-chapter customization for the pairing-reveal email. A chapter that
-- leaves both columns null falls back to the Edge Function's default
-- template, so nothing breaks for chapters that never customize.
--
-- Merge tags recognized by send-pairing-reveal at send time:
--   {{first_name}}    — the Big's first name (or "there" if unknown)
--   {{little_names}}  — comma-separated Little names for this Big
--   {{chapter_name}}  — the group name
begin;

alter table public.groups
  add column if not exists reveal_email_subject text,
  add column if not exists reveal_email_body text;

-- 0014's column-level UPDATE grant pattern — new editable columns must be
-- added here or an admin's direct .update({...}) gets permission-denied.
grant update (reveal_email_subject, reveal_email_body) on public.groups to authenticated;

commit;
