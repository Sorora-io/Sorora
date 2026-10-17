-- Expose saved capacity preferences as admin submission metadata, never ranked choices.
begin;
create or replace function public.get_submission_status_details(p_group_id uuid,p_cycle_id uuid)
returns table(user_id uuid,role text,name text,email text,submitted boolean,willing_to_take_twins boolean,wanted_little_count integer)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can view submission status.';
  end if;
  if not exists(select 1 from public.cycles c where c.id=p_cycle_id and c.group_id=p_group_id) then
    raise exception 'This cycle does not belong to your chapter.';
  end if;
  return query select s.user_id,s.role,s.name,s.email,s.submitted,
    case when m.role='big' then m.willing_to_take_twins else null end,
    case when m.role='big' then m.wanted_little_count else null end
    from public.get_blind_submission_status(p_group_id,p_cycle_id) s
    join public.cycle_memberships(p_group_id,p_cycle_id) m on m.user_id=s.user_id;
end;$$;
revoke all on function public.get_submission_status_details(uuid,uuid) from public,anon;
grant execute on function public.get_submission_status_details(uuid,uuid) to authenticated;

create or replace function public.export_chapter_rankings(p_group_id uuid, p_cycle_id uuid, p_include_preferences boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can export submissions.';
  end if;
  if not exists (select 1 from public.cycles where id = p_cycle_id and group_id = p_group_id) then
    raise exception 'This cycle does not belong to your chapter.';
  end if;
  -- Keep the privacy setting stable until this export finishes.
  perform 1 from public.groups where id = p_group_id for share;
  if p_include_preferences and not exists (select 1 from public.groups where id = p_group_id and blind_rankings = false) then
    raise exception 'Blind rankings are on. Turn them off in Organization settings before exporting preferences.';
  end if;
  select jsonb_build_object(
    'chapter', g.name, 'cycle', c.label, 'cycleId', c.id,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'name', p.name, 'email', p.email, 'role', m.role,
      'submitted', r.ranker_id is not null,
      'willingToTakeTwins', case when m.role='big' then m.willing_to_take_twins else null end,
      'wantedLittleCount', case when m.role='big' then m.wanted_little_count else null end,
      'updatedAt', r.updated_at,
      'preferences', case when p_include_preferences then coalesce((
        select jsonb_agg(jsonb_build_object('rank', pref.position, 'userId', pref.id,
          'name', target.name, 'email', target.email) order by pref.position)
        from unnest(r.ranked_ids) with ordinality pref(id, position)
        left join public.profiles target on target.id = pref.id
        -- Only resolve identities belonging to this chapter.
          and exists (select 1 from public.cycle_memberships(p_group_id,p_cycle_id) tm where tm.group_id = p_group_id and tm.user_id = pref.id)
      ), '[]'::jsonb) else null end
    ) order by m.role, lower(coalesce(p.name, p.email)), m.user_id)
    from public.cycle_memberships(p_group_id,p_cycle_id) m join public.profiles p on p.id = m.user_id
    left join public.rankings r on r.group_id = p_group_id and r.cycle_id = p_cycle_id and r.ranker_id = m.user_id
    where m.group_id = p_group_id and m.status = 'approved' and m.role in ('big', 'little')), '[]'::jsonb)
  ) into result from public.groups g join public.cycles c on c.group_id = g.id
    where g.id = p_group_id and c.id = p_cycle_id;
  return result;
end;
$$;
notify pgrst, 'reload schema';
commit;
