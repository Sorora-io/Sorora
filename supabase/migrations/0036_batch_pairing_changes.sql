-- Execute the reviewed sequence under one transaction and version check.
create or replace function public.change_pairings_batch(
 p_group_id uuid, p_cycle_id uuid, p_operations jsonb, p_expected_version text, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare operation jsonb;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can change pairings.'; end if;
 if p_operations is null or jsonb_typeof(p_operations) <> 'array' then raise exception 'Provide a list of pairing changes.'; end if;
 if jsonb_array_length(p_operations) not between 1 and 200 then raise exception 'Review between 1 and 200 pairing changes.'; end if;
 perform 1 from public.groups where id=p_group_id for update;
 perform 1 from public.cycles where id=p_cycle_id and group_id=p_group_id for update;
 if p_expected_version is distinct from public.pairing_version(p_cycle_id) then raise exception 'Pairings changed since you opened the editor. Refresh and review them again.'; end if;
 for operation in select value from jsonb_array_elements(p_operations) loop
  perform public.change_pairing(p_group_id,p_cycle_id,
   (operation->>'littleId')::uuid,(operation->>'toBigId')::uuid,
   (operation->>'swapLittleId')::uuid,public.pairing_version(p_cycle_id),p_reason);
 end loop;
end;
$$;
revoke all on function public.change_pairings_batch(uuid,uuid,jsonb,text,text) from public,anon;
grant execute on function public.change_pairings_batch(uuid,uuid,jsonb,text,text) to authenticated;
