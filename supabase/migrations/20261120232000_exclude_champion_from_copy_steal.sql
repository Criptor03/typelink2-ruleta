-- Prevent copy/steal effects from selecting cards owned by the champion (tramo 12).

do $patch$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('public.get_opponent_card_choices()'::regprocedure) into v_definition;
  if position('tp.current_tramo < 12' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '  join public.profiles p on p.id = pc.owner_id'||E'\n'||
      '  where pc.owner_id is distinct from v_user',
      '  join public.profiles p on p.id = pc.owner_id'||E'\n'||
      '  left join public.player_tramo_progress tp on tp.owner_id = pc.owner_id'||E'\n'||
      '  where pc.owner_id is distinct from v_user and coalesce(tp.current_tramo, 0) < 12'
    );
    execute v_definition;
  end if;
end;
$patch$;

do $patch$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure) into v_definition;
  if position('coalesce((select tp.current_tramo from public.player_tramo_progress tp where tp.owner_id = pc.owner_id), 0) < 12' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '          and pc.remaining_uses > 0'||E'\n'||
      '          and cc.is_active = true',
      '          and pc.remaining_uses > 0'||E'\n'||
      '          and coalesce((select tp.current_tramo from public.player_tramo_progress tp where tp.owner_id = pc.owner_id), 0) < 12'||E'\n'||
      '          and cc.is_active = true'
    );
    execute v_definition;
  end if;
end;
$patch$;