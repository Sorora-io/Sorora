begin;
-- Merge requests never expose notes or ranking contents to platform operators.
create table public.account_merge_requests (
 id uuid primary key default gen_random_uuid(), source_id uuid not null, target_id uuid not null,
 source_email text not null,target_email text not null,created_by uuid not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',
 source_approved_at timestamptz,target_approved_at timestamptz,
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 preview_nonce uuid,preview_fingerprint text,check(source_id<>target_id)
);
create table public.account_merge_audit (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 source_id uuid not null unique,target_id uuid not null,actor_id uuid not null,
 choices jsonb not null,summary jsonb not null,created_at timestamptz not null default now()
);
alter table public.account_merge_requests enable row level security;
alter table public.account_merge_audit enable row level security;
revoke all on public.account_merge_requests,public.account_merge_audit from public,anon,authenticated;

create function public.account_was_merged() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_merge_audit where source_id=auth.uid());
$$;
revoke all on function public.account_was_merged() from public,anon;
grant execute on function public.account_was_merged() to authenticated;
-- Deleting Auth users cannot invalidate an already-issued JWT. Deny their
-- remaining writes at the database boundary, including security-definer RPCs.
create function public.reject_merged_account_writes() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.account_was_merged() then raise exception 'This account was merged. Sign in to the account you kept.' using errcode='42501'; end if;
 if tg_op='DELETE' then return old; end if;
 if tg_table_name='rankings' and exists(select 1 from jsonb_array_elements_text(to_jsonb(new)->'ranked_ids') e(uid) join public.account_merge_audit a on a.source_id::text=e.uid) then raise exception 'A ranked account was merged. Reload your ranking before saving.';end if;
 return new;
end;$$;
revoke all on function public.reject_merged_account_writes() from public,anon,authenticated;
do $$ declare t record;begin
 for t in select tablename from pg_catalog.pg_tables where schemaname='public' loop
 execute format('create trigger reject_merged_account_writes before insert or update or delete on public.%I for each row execute function public.reject_merged_account_writes()',t.tablename);
 end loop;
 if to_regclass('storage.objects') is not null then
 execute 'create policy "merged accounts denied" on storage.objects as restrictive for all to authenticated using (not public.account_was_merged()) with check (not public.account_was_merged())';
 end if;
end;$$;

-- Deterministic internal fingerprint; never returned to clients. The client
-- gets a random nonce, avoiding a hash oracle for private notes/rankings.
create function public.account_merge_fingerprint(s uuid,t uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object(
 'users',(select jsonb_agg(jsonb_build_array(id,email,email_confirmed_at) order by id) from auth.users where id in(s,t)),
 'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p where id in(s,t)),
 'memberships',(select jsonb_agg(to_jsonb(m) order by id) from public.memberships m where user_id in(s,t)),
 'rankings',(select jsonb_agg(to_jsonb(r) order by id) from public.rankings r where ranker_id in(s,t) or s=any(ranked_ids) or t=any(ranked_ids)),
 'pairings',(select jsonb_agg(to_jsonb(p) order by id) from public.pairings p where big_id in(s,t) or little_id in(s,t)),
 'notes',(select jsonb_agg(to_jsonb(n) order by id) from public.notes n where author_id in(s,t) or subject_id in(s,t)),
 'groups',(select jsonb_agg(to_jsonb(g) order by id) from public.groups g where owner_id in(s,t) or id in(select group_id from public.memberships where user_id in(s,t))),
 'cycles',(select jsonb_agg(to_jsonb(c) order by id) from public.cycles c where group_id in(select group_id from public.memberships where user_id in(s,t))),
 'exclusions',(select jsonb_agg(to_jsonb(e) order by cycle_id,user_id) from public.cycle_exclusions e where user_id in(s,t)),
 'grants',(select jsonb_agg(to_jsonb(g) order by user_id) from public.superuser_grants g where user_id in(s,t))
 )::text);
$$;
revoke all on function public.account_merge_fingerprint(uuid,uuid) from public,anon,authenticated;

create function public.create_account_merge(p_source uuid,p_target_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare s auth.users;t auth.users;r uuid;
begin
 if not public.is_superuser() then raise exception 'Superuser access required.' using errcode='42501'; end if;
 select * into s from auth.users where id=p_source;
 select * into t from auth.users where lower(email)=lower(btrim(p_target_email));
 if s.id is null or t.id is null or s.email_confirmed_at is null or t.email_confirmed_at is null then raise exception 'Both accounts must exist and have verified email addresses.';end if;
 if s.id=t.id then raise exception 'Choose two different accounts.';end if;
 if s.id=auth.uid() or exists(select 1 from public.superuser_grants where user_id=s.id) then raise exception 'A superuser account cannot be the duplicate account.';end if;
 if not exists(select 1 from public.profiles where id=s.id) or not exists(select 1 from public.profiles where id=t.id) then raise exception 'Both accounts need a profile before merging.';end if;
 if exists(select 1 from public.account_merge_audit where source_id in(s.id,t.id)) then raise exception 'One of these accounts was already merged.';end if;
 insert into public.account_merge_requests(source_id,target_id,source_email,target_email,created_by)
 values(s.id,t.id,s.email,t.email,auth.uid()) returning id into r;return r;
end;$$;

create function public.get_account_merge_approval(p_request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.account_merge_requests;
begin
 if public.account_was_merged() then raise exception 'This account was merged.' using errcode='42501';end if;
 select * into r from public.account_merge_requests where id=p_request and auth.uid() in(source_id,target_id);
 if not found then raise exception 'This merge request is unavailable for your account.' using errcode='42501';end if;
 return jsonb_build_object('sourceEmail',r.source_email,'targetEmail',r.target_email,'status',r.status,
 'expired',r.expires_at<=now(),'isSource',auth.uid()=r.source_id,
 'approved',coalesce(case when auth.uid()=r.source_id then r.source_approved_at else r.target_approved_at end > now()-interval '30 minutes',false));
end;$$;
create function public.approve_account_merge(p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.account_merge_requests;
begin
 select * into r from public.account_merge_requests where id=p_request and auth.uid() in(source_id,target_id) for update;
 if not found or r.status<>'pending' or r.expires_at<=now() then raise exception 'This merge request is unavailable or expired.' using errcode='42501';end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and email=case when auth.uid()=r.source_id then r.source_email else r.target_email end) then raise exception 'The verified account email has changed. Start a new request.';end if;
 if p_approve and not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid() and created_at>now()-interval '15 minutes') then raise exception 'Sign out and sign in again before approving this merge.';end if;
 update public.account_merge_requests set
 source_approved_at=case when auth.uid()=source_id then case when p_approve then now() end else source_approved_at end,
 target_approved_at=case when auth.uid()=target_id then case when p_approve then now() end else target_approved_at end
 where id=p_request;
end;$$;

create function public.preview_account_merge(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.account_merge_requests;result jsonb;nonce uuid:=gen_random_uuid();blockers jsonb:='[]';
begin
 if not public.is_superuser() then raise exception 'Superuser access required.' using errcode='42501';end if;
 select * into r from public.account_merge_requests where id=p_request and created_by=auth.uid() for update;
 if not found or r.status<>'pending' or r.expires_at<=now() then raise exception 'This merge request is unavailable or expired.';end if;
 if (select count(*) from auth.users where (id=r.source_id and email=r.source_email or id=r.target_id and email=r.target_email) and email_confirmed_at is not null)<>2 then raise exception 'An account or its verified email changed. Start a new request.';end if;
 if exists(select 1 from public.superuser_grants where user_id=r.source_id) then blockers:=blockers||jsonb_build_array('The duplicate account is a superuser.');end if;
 if exists(select 1 from public.memberships s join public.memberships t using(group_id) where s.user_id=r.source_id and t.user_id=r.target_id and s.role<>t.role) then blockers:=blockers||jsonb_build_array('Chapter roles differ. A chapter admin must align the roles before merging.');end if;
 if exists(select 1 from public.pairings s join public.pairings t using(cycle_id) where (s.big_id=r.source_id or s.little_id=r.source_id) and (t.big_id=r.target_id or t.little_id=r.target_id)) then blockers:=blockers||jsonb_build_array('Both accounts are paired in the same cycle. Resolve the pairings before merging.');end if;
 if exists(select 1 from public.cycle_exclusions s join public.cycle_exclusions t using(cycle_id) where s.user_id=r.source_id and t.user_id=r.target_id and s.excluded<>t.excluded) then blockers:=blockers||jsonb_build_array('Cycle participation differs. A chapter admin must resolve it before merging.');end if;
 if exists(select 1 from public.pairings p join public.cycle_exclusions e using(cycle_id) where (p.big_id in(r.source_id,r.target_id) or p.little_id in(r.source_id,r.target_id)) and e.user_id in(r.source_id,r.target_id) and e.excluded) then blockers:=blockers||jsonb_build_array('The combined account would be paired while excluded. Resolve participation first.');end if;
 update public.account_merge_requests set preview_nonce=nonce,preview_fingerprint=public.account_merge_fingerprint(r.source_id,r.target_id) where id=r.id;
 select jsonb_build_object('requestId',r.id,'nonce',nonce,'sourceEmail',r.source_email,'targetEmail',r.target_email,
 'sourceApproved',coalesce(r.source_approved_at>now()-interval '30 minutes',false),'targetApproved',coalesce(r.target_approved_at>now()-interval '30 minutes',false),'blockers',blockers,
 'counts',jsonb_build_object('memberships',(select count(*) from public.memberships where user_id=r.source_id),
 'rankings',(select count(*) from public.rankings where ranker_id=r.source_id),'rankingReferences',(select count(*) from public.rankings where r.source_id=any(ranked_ids)),
 'notes',(select count(*) from public.notes where author_id=r.source_id or subject_id=r.source_id),
 'pairings',(select count(*) from public.pairings where big_id=r.source_id or little_id=r.source_id),
 'ownedChapters',(select count(*) from public.groups where owner_id=r.source_id)),
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('groupId',s.group_id,'name',g.name,
 'sourceRole',s.role,'targetRole',t.role,'sourceStatus',s.status,'targetStatus',t.status,'sourceAdmin',s.is_admin,'targetAdmin',t.is_admin,'ownsChapter',g.owner_id in(r.source_id,r.target_id)) order by g.name)
 from public.memberships s join public.memberships t using(group_id) join public.groups g on g.id=s.group_id where s.user_id=r.source_id and t.user_id=r.target_id),'[]'),
 'rankings',coalesce((select jsonb_agg(jsonb_build_object('cycleId',s.cycle_id,'name',g.name||' · '||c.label,'sourceUpdated',s.updated_at,'targetUpdated',t.updated_at) order by c.started_at)
 from public.rankings s join public.rankings t using(cycle_id) join public.cycles c on c.id=s.cycle_id join public.groups g on g.id=s.group_id where s.ranker_id=r.source_id and t.ranker_id=r.target_id),'[]')) into result;
 return result;
end;$$;

-- Rewrites structured identity values, never substring-replaces private text.
create function public.replace_merge_identity(value jsonb,s uuid,t uuid) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(value)='object' then select jsonb_object_agg(key,public.replace_merge_identity(v,s,t)) into result from jsonb_each(value) e(key,v);return coalesce(result,'{}');
 elsif jsonb_typeof(value)='array' then select jsonb_agg(public.replace_merge_identity(v,s,t) order by ord) into result from jsonb_array_elements(value) with ordinality e(v,ord);return coalesce(result,'[]');
 elsif value=to_jsonb(s::text) then return to_jsonb(t::text);else return value;end if;
end;$$;
revoke all on function public.replace_merge_identity(jsonb,uuid,uuid) from public,anon,authenticated;

-- Existing excluded rankings remain saved when identity changes; this narrow
-- exception cannot be activated by setting a client-controlled flag alone.
create function public.account_merge_in_progress() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superuser() and exists(select 1 from public.account_merge_requests r
 where r.id=nullif(current_setting('app.account_merge',true),'')::uuid and r.status='pending' and r.created_by=auth.uid()
 and r.expires_at>now() and r.source_approved_at>now()-interval '30 minutes' and r.target_approved_at>now()-interval '30 minutes');
$$;
revoke all on function public.account_merge_in_progress() from public,anon,authenticated;
create or replace function public.guard_cycle_participant() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.account_merge_in_progress() then return new;end if;
 perform 1 from public.groups where id=new.group_id for update;
 if exists(select 1 from public.cycle_exclusions e where e.cycle_id=new.cycle_id and e.group_id=new.group_id and e.excluded and
 (case when tg_table_name='rankings' then e.user_id=(to_jsonb(new)->>'ranker_id')::uuid else e.user_id in ((to_jsonb(new)->>'big_id')::uuid,(to_jsonb(new)->>'little_id')::uuid) end)) then raise exception 'This member is not participating in this cycle.';end if;return new;
end;$$;

create function public.complete_account_merge(p_request uuid,p_nonce uuid,p_choices jsonb,p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.account_merge_requests;v jsonb;row record;choice text;summary jsonb;audit_id uuid;s uuid;t uuid;
begin
 if not public.is_superuser() then raise exception 'Superuser access required.' using errcode='42501';end if;
 select * into r from public.account_merge_requests where id=p_request and created_by=auth.uid() for update;
 if not found or r.status<>'pending' or r.expires_at<=now() then raise exception 'This merge request is unavailable or expired.';end if;
 if r.source_approved_at is null or r.target_approved_at is null or least(r.source_approved_at,r.target_approved_at)<=now()-interval '30 minutes' then raise exception 'Both accounts must approve within the last 30 minutes.';end if;
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

create function public.cancel_account_merge(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_superuser() then raise exception 'Superuser access required.' using errcode='42501';end if;
 update public.account_merge_requests set status='cancelled' where id=p_request and created_by=auth.uid() and status='pending';
end;$$;
revoke all on function public.create_account_merge(uuid,text),public.get_account_merge_approval(uuid),public.approve_account_merge(uuid,boolean),public.preview_account_merge(uuid),public.complete_account_merge(uuid,uuid,jsonb,text),public.cancel_account_merge(uuid) from public,anon;
grant execute on function public.create_account_merge(uuid,text),public.get_account_merge_approval(uuid),public.approve_account_merge(uuid,boolean),public.preview_account_merge(uuid),public.complete_account_merge(uuid,uuid,jsonb,text),public.cancel_account_merge(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
