do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.draw_normal_card_with_tramo_credit_core()'::regprocedure
  ) into v_definition;

  v_old := $old$
  if v_normal_count >= v_limit then
    raise exception 'Tu baraja está completa. Tu límite efectivo es de % cartas normales.', v_limit using errcode = 'P0001';
  end if;
$old$;
  v_new := $new$
  if v_normal_count >= v_limit
     and coalesce(v_progress.bonus_spins_remaining, 0) < 1 then
    raise exception 'Tu baraja está completa. Para superar el límite necesitas giros extra.' using errcode = 'P0001';
  end if;
$new$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró la validación del límite normal.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,v_new);

  v_old := $old$
  if v_progress.spins_remaining > 0 then
    update public.player_tramo_progress
      set spins_remaining = spins_remaining - 1,
          updated_at = pg_catalog.now()
    where owner_id = v_user;
    v_progress.spins_remaining := v_progress.spins_remaining - 1;
  else
    update public.player_tramo_progress
      set bonus_spins_remaining = bonus_spins_remaining - 1,
          updated_at = pg_catalog.now()
    where owner_id = v_user;
    v_progress.bonus_spins_remaining := v_progress.bonus_spins_remaining - 1;
  end if;
$old$;
  v_new := $new$
  if v_progress.spins_remaining > 0
     and not (
       v_normal_count >= v_limit
       and coalesce(v_progress.bonus_spins_remaining, 0) > 0
     ) then
    update public.player_tramo_progress
      set spins_remaining = spins_remaining - 1,
          updated_at = pg_catalog.now()
    where owner_id = v_user;
    v_progress.spins_remaining := v_progress.spins_remaining - 1;
  else
    update public.player_tramo_progress
      set bonus_spins_remaining = bonus_spins_remaining - 1,
          updated_at = pg_catalog.now()
    where owner_id = v_user;
    v_progress.bonus_spins_remaining := v_progress.bonus_spins_remaining - 1;
  end if;
$new$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el bloque de consumo de giros.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,v_new);

  execute v_definition;
end;
$migration$;
