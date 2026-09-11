-- Tracks the last time reminder emails went out for a group, so the
-- send-ranking-reminders Edge Function can enforce a cooldown and an admin
-- repeatedly clicking "Send reminder emails" can't spam members or burn
-- through the Resend quota.
alter table public.groups add column if not exists reminders_last_sent_at timestamptz;
