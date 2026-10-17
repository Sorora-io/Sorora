begin;
-- Superuser-authorized merges retain preview freshness, conflict choices,
-- verified accounts, exact confirmation and audit; owner approvals are optional.
create or replace function public.account_merge_in_progress() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superuser() and exists(select 1 from public.account_merge_requests r
 where r.id=nullif(current_setting('app.account_merge',true),'')::uuid and r.status='pending' and r.created_by=auth.uid()
 and r.expires_at>now());
$$;
create or replace function public.complete_account_merge(p_request uuid,p_nonce uuid,p_choices jsonb,p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.account_merge_requests;v jsonb;row record;choice text;summary jsonb;audit_id uuid;s uuid;t uuid;
begin
 if not public.is_superuser() then raise exception 'Superuser access required.' using errcode='42501';end if;
 select * into r from public.account_merge_requests where id=p_request and created_by=auth.uid() for update;
 if not found or r.status<>'pending' or r.expires_at<=now() then raise exception 'This merge request is unavailable or expired.';end if;
 if p_confirmation is distinct from r.source_email then raise exception 'Type the duplicate account email exactly to confirm.';end if;
 if p_nonce is null or p_nonce is distinct from r.preview_nonce then raise exception 'Reload the merge preview before continuing.';end if;
 lock table public.profiles,public.groups,public.cycles,public.memberships,public.rankings,public.pairings,public.notes,public.cycle_exclusions,public.cycle_participation_history,public.pairing_change_history,public.superuser_grants in share row exclusive mode;
 perform 1 from auth.users where id in(r.source_id,r.target_id) order by id for update;
 if r.preview_fingerprint is distinct from public.account_merge_fingerprint(r.source_id,r.target_id) then raise exception 'Account data changed. Reload the preview and review it again.';end if;
 v:=public.preview_account_merge(r.id);
 if jsonb_array_length(v->'blockers')>0 then raise exception 'Resolve the merge blockers before continuing.';end if;
 if p_choices->>'profile' not in('source','target') or p_choices->>'profile' is null then raise exception 'Choose which profile to keep.';end if;
 s:=r.source_id;t:=r.target_id;summary:=v->'counts';
 perform set_config('app.account_merge',r.id::text,true);
 for row in select sm.group_id from public.memberships sm join public.memberships tm using(group_id) where sm.user_id=s and tm.user_id=t loop
 choice:=p_choices->'memberships'->>row.group_id::text;
 if choice not in('source','target') or choice is null then raise exception 'Choose a membership for every shared chapter.';end if;
 delete from public.memberships where group_id=row.group_id and user_id=case when choice='source' then t else s end;
 end loop;
 update public.memberships set user_id=t where user_id=s;
 -- Ownership transfer must leave an approved admin, without converting a Little.
 if exists(select 1 from public.groups g join public.memberships m on m.group_id=g.id and m.user_id=t where g.owner_id in(s,t) and m.role='little') then raise exception 'A chapter owner must keep an admin or Big membership.';end if;
 insert into public.memberships(group_id,user_id,role,is_admin,status) select g.id,t,'admin',true,'approved' from public.groups g where g.owner_id in(s,t) and not exists(select 1 from public.memberships m where m.group_id=g.id and m.user_id=t);
 update public.memberships set status='approved',is_admin=true,requested_role=case when requested_role='little' then null else requested_role end
 where user_id=t and group_id in(select id from public.groups where owner_id in(s,t));
 for row in select sr.cycle_id from public.rankings sr join public.rankings tr using(cycle_id) where sr.ranker_id=s and tr.ranker_id=t loop
 choice:=p_choices->'rankings'->>row.cycle_id::text;
 if choice not in('source','target') or choice is null then raise exception 'Choose a ranking submission for every conflicting cycle.';end if;
 delete from public.rankings where cycle_id=row.cycle_id and ranker_id=case when choice='source' then t else s end;
 end loop;
 update public.rankings set ranker_id=t where ranker_id=s;
 update public.rankings ranked set ranked_ids=coalesce((select array_agg(x.uid order by x.first_position) from
 (select case when uid=s then t else uid end uid,min(position) first_position from unnest(ranked.ranked_ids) with ordinality e(uid,position)
 group by case when uid=s then t else uid end) x),'{}') where s=any(ranked.ranked_ids);
 update public.pairings set big_id=case when big_id=s then t else big_id end,little_id=case when little_id=s then t else little_id end where big_id=s or little_id=s;
 update public.notes set author_id=case when author_id=s then t else author_id end,subject_id=case when subject_id=s then t else subject_id end where author_id=s or subject_id=s;
 delete from public.cycle_exclusions se using public.cycle_exclusions te where se.user_id=s and te.user_id=t and se.cycle_id=te.cycle_id;
 update public.cycle_exclusions set user_id=t where user_id=s;
 update public.cycle_exclusions set changed_by=t where changed_by=s;
 update public.cycle_participation_history set user_id=case when user_id=s then t else user_id end,actor_id=case when actor_id=s then t else actor_id end,removed_pairings=public.replace_merge_identity(removed_pairings,s,t) where user_id=s or actor_id=s or removed_pairings::text like '%'||s::text||'%';
 update public.pairing_change_history set actor_id=case when actor_id=s then t else actor_id end,changes=public.replace_merge_identity(changes,s,t) where actor_id=s or changes::text like '%'||s::text||'%';
 update public.groups set owner_id=t where owner_id=s;
 update public.groups set created_by=t where created_by=s;
 update public.cycles set created_by=t where created_by=s;
 update public.superuser_grants set granted_by=t where granted_by=s;
 if p_choices->>'profile'='source' then
 update public.profiles dst set name=src.name,bio=src.bio,avatar_url=src.avatar_url,major=src.major,college=src.college,year=src.year,hometown=src.hometown from public.profiles src where src.id=s and dst.id=t;
 end if;
 -- Keep existing avatar URLs intact while transferring storage ownership.
 if to_regclass('storage.objects') is not null then
 if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='owner') then
 execute 'update storage.objects set owner=$2 where owner=$1' using s,t;
 end if;
 if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='owner_id') then
 execute 'update storage.objects set owner_id=$2 where owner_id=$1' using s::text,t::text;
 end if;
 end if;
 -- Future schema additions fail closed instead of silently cascading away data.
 for row in select c.conrelid::regclass as tbl,a.attname from pg_catalog.pg_constraint c join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 join pg_catalog.pg_class cl on cl.oid=c.conrelid join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
 where c.contype='f' and ns.nspname='public' and c.confrelid in('public.profiles'::regclass,'auth.users'::regclass) and array_length(c.conkey,1)=1 and c.conrelid<>'public.profiles'::regclass loop
 execute format('select exists(select 1 from %s where %I=$1)',row.tbl,row.attname) into strict choice using s;
 if choice::boolean then raise exception 'Related data needs an additional merge rule. No changes were saved.';end if;
 end loop;
 insert into public.account_merge_audit(request_id,source_id,target_id,actor_id,choices,summary) values(r.id,s,t,auth.uid(),p_choices,summary) returning id into audit_id;
 -- All application references have moved. Removing Auth now also removes
 -- refresh sessions; public/storage guards reject any lingering old JWT.
 delete from auth.users where id=s;
 update public.account_merge_requests set status='completed',preview_nonce=null,preview_fingerprint=null where id=r.id;
 perform set_config('app.account_merge','',true);
 return jsonb_build_object('auditId',audit_id,'targetEmail',r.target_email,'summary',summary);
end;$$;

notify pgrst,'reload schema';
commit;
