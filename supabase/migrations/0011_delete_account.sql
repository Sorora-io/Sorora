-- Lets a signed-in user permanently delete their own account. Paste into
-- the Supabase SQL Editor and run once. Safe to re-run.

-- groups.created_by was NOT NULL with no delete action, which would forever
-- block a group's original creator from deleting their account even after
-- transferring ownership away — it's just an audit trail, not a permission,
-- so it's fine for it to go null once that person is gone.
alter table public.groups alter column created_by drop not null;
alter table public.groups drop constraint if exists groups_created_by_fkey;
alter table public.groups
  add constraint groups_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- groups.owner_id deliberately keeps its default (no action) — a chapter
-- must always have an accountable owner, so deleting the owner's account is
-- blocked until they transfer ownership to someone else. The function below
-- turns that low-level FK error into a plain-English message.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
exception
  when foreign_key_violation then
    raise exception 'You still own at least one chapter — transfer ownership to another admin first, then delete your account.';
end;
$$;
