CREATE OR REPLACE FUNCTION app_private.get_trainer_active_card_effect_count_core(p_trainer_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_player_tramo integer := 0;
  v_event_tramo integer := 0;
  v_effect_count integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para consultar los efectos de un entrenador.'
      using errcode = '28000';
  end if;

  if p_trainer_id is null then
    raise exception 'Debes indicar el entrenador que quieres consultar.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_trainer_id
  ) then
    raise exception 'El entrenador seleccionado no existe.'
      using errcode = 'P0002';
  end if;

  select coalesce(pt.current_tramo, 0)
    into v_player_tramo
  from public.player_tramo_progress pt
  where pt.owner_id = p_trainer_id;

  select coalesce(es.current_tramo, 0)
    into v_event_tramo
  from public.event_settings es
  where es.singleton = true;

  select count(distinct active_cards.source_key)::integer
    into v_effect_count
  from (
    select coalesce(
      pe.source_card_instance_id::text,
      'player-effect:' || pe.id::text
    ) as source_key
    from public.player_effects pe
    where pe.owner_id = p_trainer_id
      and pe.status = 'active'
      and pe.starts_at <= pg_catalog.now()
      and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
      and (
        pe.expires_after_tramo is null
        or pe.expires_after_tramo >= v_player_tramo
      )
      and (
        pe.duration_type <> 'charges'
        or coalesce(pe.remaining_uses, 0) > 0
      )

    union all

    select coalesce(
      ee.source_card_instance_id::text,
      'event-effect:' || ee.id::text
    ) as source_key
    from public.event_effects ee
    where ee.status = 'active'
      and ee.starts_at <= pg_catalog.now()
      and (ee.expires_at is null or ee.expires_at > pg_catalog.now())
      and (
        ee.expires_after_tramo is null
        or ee.expires_after_tramo >= v_event_tramo
      )
      and (
        ee.duration_type <> 'charges'
        or coalesce(ee.remaining_uses, 0) > 0
      )
  ) active_cards;

  return coalesce(v_effect_count, 0);
end;
$function$


revoke all on function app_private.get_trainer_active_card_effect_count_core(uuid)
  from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_trainer_active_card_effect_count(p_trainer_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select app_private.get_trainer_active_card_effect_count_core(p_trainer_id);
$function$


revoke all on function public.get_trainer_active_card_effect_count(uuid)
  from public, anon;

grant execute on function public.get_trainer_active_card_effect_count(uuid)
  to authenticated;
