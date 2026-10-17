begin;
alter table public.pairing_change_history add column if not exists operation text not null default 'change' check(operation in ('change','clear'));
create or replace function public.clear_cycle_pairings(p_group_id uuid,p_cycle_id uuid,p_expected_version text,p_confirmation text)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.cycles; changes jsonb; removed integer; actor text;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can clear pairings.' using errcode='42501';end if;
 if p_confirmation is distinct from 'clear' then raise exception 'Type clear to confirm.';end if;
 perform 1 from public.groups where id=p_group_id for update;
 select * into c from public.cycles where id=p_cycle_id and group_id=p_group_id for update;
 if not found or c.ended_at is not null or not exists(select 1 from public.groups where id=p_group_id and active_cycle_id=p_cycle_id) then raise exception 'Only the active open cycle can be cleared.';end if;
 if c.pairing_edits_locked_at is not null or c.reveal_completed_at is not null or exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then raise exception 'Reveal sending has started. Pairings cannot be cleared.';end if;
 if p_expected_version is distinct from public.pairing_version(p_cycle_id) then raise exception 'Pairings changed. Refresh and review before clearing.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('littleId',p.little_id,'littleName',coalesce(l.name,'Former member'),'fromBigId',p.big_id,'fromBigName',coalesce(b.name,'Former member'),'toBigId',null,'toBigName','Unmatched') order by p.little_id),'[]'::jsonb) into changes
 from public.pairings p left join public.profiles l on l.id=p.little_id left join public.profiles b on b.id=p.big_id where p.group_id=p_group_id and p.cycle_id=p_cycle_id;
 delete from public.pairings where group_id=p_group_id and cycle_id=p_cycle_id;get diagnostics removed=row_count;
 select name into actor from public.profiles where id=auth.uid();
 insert into public.pairing_change_history(group_id,cycle_id,actor_id,actor_name,reason,changes,operation) values(p_group_id,p_cycle_id,auth.uid(),coalesce(actor,'Chapter admin'),'Cleared cycle pairings to review and rerun matching',changes,'clear');
 update public.cycles set reveal_scheduled_at=null where id=p_cycle_id;
 return removed;
end;$$;
revoke all on function public.clear_cycle_pairings(uuid,uuid,text,text) from public,anon;
grant execute on function public.clear_cycle_pairings(uuid,uuid,text,text) to authenticated;
create or replace function public.run_blind_matching(p_group_id uuid,p_cycle_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only a chapter admin can run matching.'; end if;
 perform 1 from public.groups where id=p_group_id for update;
 perform 1 from public.cycles where id=p_cycle_id and group_id=p_group_id for update;
 if exists(select 1 from public.cycles where id=p_cycle_id and (pairing_edits_locked_at is not null or reveal_completed_at is not null)) or
 exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then raise exception 'Reveal sending has started. Matching cannot be rerun.'; end if;
 if exists(select 1 from public.pairing_change_history where cycle_id=p_cycle_id) and not (not exists(select 1 from public.pairings where cycle_id=p_cycle_id) and exists(select 1 from public.pairing_change_history where cycle_id=p_cycle_id and operation='clear')) then raise exception 'This cycle has reviewed pairing changes. Use Edit pairings to preserve those changes.'; end if;
 return public.run_blind_matching_unreviewed(p_group_id,p_cycle_id);
end;
$$;
notify pgrst,'reload schema';
commit;
