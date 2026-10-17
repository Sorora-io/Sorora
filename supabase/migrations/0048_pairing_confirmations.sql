begin;
alter table public.pairings
 add column if not exists review_confirmed boolean,
 add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
 add column if not exists reviewed_by_name text,
 add column if not exists reviewed_at timestamptz;

-- An approval belongs to the exact assignment, never its replacement.
create or replace function public.reset_pairing_confirmation() returns trigger
language plpgsql set search_path='' as $$
begin
 if row(new.group_id,new.cycle_id,new.big_id,new.little_id) is distinct from row(old.group_id,old.cycle_id,old.big_id,old.little_id) then
  new.review_confirmed:=null; new.reviewed_by:=null; new.reviewed_by_name:=null; new.reviewed_at:=null;
 end if;
 return new;
end;$$;
revoke all on function public.reset_pairing_confirmation() from public,anon,authenticated;
drop trigger if exists reset_pairing_confirmation on public.pairings;
create trigger reset_pairing_confirmation before update on public.pairings
 for each row execute function public.reset_pairing_confirmation();

create or replace function public.get_pairing_confirmations(p_group_id uuid,p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.cycles; lock_reason text;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can review pairings.' using errcode='42501';end if;
 perform 1 from public.groups where id=p_group_id for share;
 select * into c from public.cycles where id=p_cycle_id and group_id=p_group_id for share;
 if not found then raise exception 'Cycle not found in this chapter.';end if;
 if c.ended_at is not null or not exists(select 1 from public.groups where id=p_group_id and active_cycle_id=p_cycle_id) then
  lock_reason:='This cycle is closed. Confirmations are read-only.';
 elsif c.pairing_edits_locked_at is not null or c.reveal_completed_at is not null or exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then
  lock_reason:='Reveal sending has started. Confirmations are read-only.';
 end if;
 return jsonb_build_object('version',public.pairing_version(p_cycle_id),'lockReason',lock_reason,
  'decisions',coalesce((select jsonb_agg(jsonb_build_object('bigId',p.big_id,'littleId',p.little_id,'confirmed',p.review_confirmed,'reviewedBy',p.reviewed_by_name,'reviewedAt',p.reviewed_at) order by p.big_id,p.little_id)
  from public.pairings p where p.group_id=p_group_id and p.cycle_id=p_cycle_id and p.review_confirmed is not null),'[]'::jsonb));
end;$$;

create or replace function public.set_pairing_confirmation(p_group_id uuid,p_cycle_id uuid,p_big_id uuid,p_little_id uuid,p_expected_version text,p_confirmed boolean)
returns void language plpgsql security definer set search_path='' as $$
declare c public.cycles; pair public.pairings; actor text; big_name text; little_name text;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can confirm pairings.' using errcode='42501';end if;
 if p_confirmed is null then raise exception 'Choose confirmed or needs review.';end if;
 perform 1 from public.groups where id=p_group_id for update;
 select * into c from public.cycles where id=p_cycle_id and group_id=p_group_id for update;
 if not found or c.ended_at is not null or not exists(select 1 from public.groups where id=p_group_id and active_cycle_id=p_cycle_id) then raise exception 'Only the active open cycle can be reviewed.';end if;
 if c.pairing_edits_locked_at is not null or c.reveal_completed_at is not null or exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then raise exception 'Reveal sending has started. Confirmations are read-only.';end if;
 if p_expected_version is distinct from public.pairing_version(p_cycle_id) then raise exception 'Pairings changed. Refresh and review before confirming.';end if;
 select * into pair from public.pairings where group_id=p_group_id and cycle_id=p_cycle_id and big_id=p_big_id and little_id=p_little_id for update;
 if not found then raise exception 'This pairing no longer exists. Refresh before confirming.';end if;
 if pair.review_confirmed is not distinct from p_confirmed then return;end if;
 select coalesce(name,'Chapter admin') into actor from public.profiles where id=auth.uid();
 select name into big_name from public.profiles where id=p_big_id;
 select name into little_name from public.profiles where id=p_little_id;
 update public.pairings set review_confirmed=p_confirmed,reviewed_by=auth.uid(),reviewed_by_name=coalesce(actor,'Chapter admin'),reviewed_at=clock_timestamp() where id=pair.id;
 -- Keep review actions in the existing permanent admin audit. This also
 -- prevents a matching rerun silently discarding manually reviewed pairs.
 insert into public.pairing_change_history(group_id,cycle_id,actor_id,actor_name,reason,changes,operation)
 values(p_group_id,p_cycle_id,auth.uid(),coalesce(actor,'Chapter admin'),
  left((case when p_confirmed then 'Confirmed pairing: ' else 'Marked pairing needs review: ' end)||coalesce(big_name,'Former Big')||' → '||coalesce(little_name,'Former Little'),2000),'[]'::jsonb,'change');
end;$$;
revoke all on function public.get_pairing_confirmations(uuid,uuid) from public,anon;
revoke all on function public.set_pairing_confirmation(uuid,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.get_pairing_confirmations(uuid,uuid) to authenticated;
grant execute on function public.set_pairing_confirmation(uuid,uuid,uuid,uuid,text,boolean) to authenticated;
-- Acknowledged one-sided pairs leave the outstanding review queue.
-- Admin-only mutuality metadata; never return ordered preferences or direction.
create or replace function public.get_matching_review(p_group_id uuid,p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can review matching.' using errcode='42501';end if;
 perform 1 from public.groups where id=p_group_id for share;
 if not exists(select 1 from public.cycles where id=p_cycle_id and group_id=p_group_id) then raise exception 'This cycle does not belong to your chapter.';end if;
 select jsonb_build_object(
 'unmatched',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'name',coalesce(p.name,'Unnamed member'),'role',m.role) order by m.role,p.name,m.user_id)
 from public.cycle_memberships(p_group_id,p_cycle_id) m join public.profiles p on p.id=m.user_id
 where m.status='approved' and m.role in('big','little') and not exists(select 1 from public.pairings pairs where pairs.group_id=p_group_id and pairs.cycle_id=p_cycle_id and (pairs.big_id=m.user_id or pairs.little_id=m.user_id))),'[]'::jsonb),
 'oneSidedPairings',coalesce((select jsonb_agg(jsonb_build_object('bigId',pairs.big_id,'littleId',pairs.little_id,'bigName',coalesce(b.name,'Former member'),'littleName',coalesce(l.name,'Former member')) order by pairs.big_id,pairs.little_id)
 from public.pairings pairs left join public.profiles b on b.id=pairs.big_id left join public.profiles l on l.id=pairs.little_id
 where pairs.group_id=p_group_id and pairs.cycle_id=p_cycle_id and pairs.review_confirmed is distinct from true and
 (exists(select 1 from public.rankings r where r.group_id=p_group_id and r.cycle_id=p_cycle_id and r.ranker_id=pairs.big_id and pairs.little_id=any(r.ranked_ids))
 <> exists(select 1 from public.rankings r where r.group_id=p_group_id and r.cycle_id=p_cycle_id and r.ranker_id=pairs.little_id and pairs.big_id=any(r.ranked_ids)))),'[]'::jsonb),
 'unsupportedPairings',coalesce((select jsonb_agg(jsonb_build_object('bigId',pairs.big_id,'littleId',pairs.little_id,'bigName',coalesce(b.name,'Former member'),'littleName',coalesce(l.name,'Former member')) order by pairs.big_id,pairs.little_id)
 from public.pairings pairs left join public.profiles b on b.id=pairs.big_id left join public.profiles l on l.id=pairs.little_id
 where pairs.group_id=p_group_id and pairs.cycle_id=p_cycle_id and not exists(select 1 from public.rankings r where r.group_id=p_group_id and r.cycle_id=p_cycle_id and ((r.ranker_id=pairs.big_id and pairs.little_id=any(r.ranked_ids)) or (r.ranker_id=pairs.little_id and pairs.big_id=any(r.ranked_ids))))),'[]'::jsonb)
 ) into result;return result;
end;$$;
revoke all on function public.get_matching_review(uuid,uuid) from public,anon;
grant execute on function public.get_matching_review(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
