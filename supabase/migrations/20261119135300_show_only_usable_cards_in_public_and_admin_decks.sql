do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.admin_get_trainer_core(uuid)'::regprocedure
  ) into v_definition;

  -- The admin profile's visible inventory should contain only cards still usable.
  v_old := $old$
  into v_inventory
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = p_player_id;
$old$;
  v_new := $new$
  into v_inventory
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = p_player_id
    and pc.status = 'available'
    and pc.remaining_uses > 0;
$new$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró la consulta de inventario en admin_get_trainer_core.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,v_new);

  -- The admin detail's main card count represents the current usable baraja.
  v_old := $old$'cards_total', count(*),$old$;
  v_new := $new$'cards_total', count(*) filter (
      where pc.status = 'available' and pc.remaining_uses > 0
    ),$new$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el contador de cartas en admin_get_trainer_core.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,v_new);

  execute v_definition;
end;
$migration$;
