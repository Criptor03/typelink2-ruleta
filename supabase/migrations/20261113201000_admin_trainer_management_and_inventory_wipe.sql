create or replace function app_private.admin_list_trainers_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer;
  v_result jsonb;
begin
  perform app_private.require_admin();

  select coalesce(es.normal_card_limit, 5)
    into v_limit
  from public.event_settings es
  where es.singleton = true;
  v_limit := coalesce(v_limit, 5);

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'current_tramo', coalesce(tp.current_tramo, 0),
        'spins_remaining', coalesce(tp.spins_remaining, 0),
        'bonus_spins_remaining', coalesce(tp.bonus_spins_remaining, 0),
        'normal_card_limit', v_limit,
        'cards_total', coalesce(inv.cards_total, 0),
        'cards_available', coalesce(inv.cards_available, 0),
        'cards_used', coalesce(inv.cards_used, 0),
        'normal_available', coalesce(inv.normal_available, 0),
        'tramo_available', coalesce(inv.tramo_available, 0),
        'fiesta_available', coalesce(inv.fiesta_available, 0)
      )
      order by p.created_at, p.display_name
    ),
    '[]'::jsonb
  )
  into v_result
  from public.profiles p
  left join public.player_tramo_progress tp on tp.owner_id = p.id
  left join lateral (
    select
      count(*)::integer as cards_total,
      count(*) filter (where pc.status = 'available' and pc.remaining_uses > 0)::integer as cards_available,
      count(*) filter (where pc.status = 'used' or pc.remaining_uses <= 0)::integer as cards_used,
      count(*) filter (
        where pc.status = 'available' and pc.remaining_uses > 0
          and cc.category = 'normal' and cc.counts_toward_normal_limit = true
      )::integer as normal_available,
      count(*) filter (
        where pc.status = 'available' and pc.remaining_uses > 0 and cc.category = 'tramo'
      )::integer as tramo_available,
      count(*) filter (
        where pc.status = 'available' and pc.remaining_uses > 0 and cc.category = 'fiesta'
      )::integer as fiesta_available
    from public.player_cards pc
    join public.card_catalog cc on cc.id = pc.card_id
    where pc.owner_id = p.id
  ) inv on true;

  return v_result;
end;
$function$;

create or replace function app_private.admin_get_trainer_core(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_progress jsonb;
  v_inventory jsonb;
  v_types jsonb;
  v_effects jsonb;
  v_stats jsonb;
  v_limit integer;
  v_current_tramo integer := 0;
begin
  perform app_private.require_admin();

  if p_player_id is null then
    raise exception 'Debes seleccionar un entrenador.' using errcode = '22023';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_player_id;

  if not found then
    raise exception 'El entrenador seleccionado ya no existe.' using errcode = 'P0002';
  end if;

  select coalesce(es.normal_card_limit, 5)
    into v_limit
  from public.event_settings es
  where es.singleton = true;
  v_limit := coalesce(v_limit, 5);

  select pg_catalog.to_jsonb(tp)
    into v_progress
  from public.player_tramo_progress tp
  where tp.owner_id = p_player_id;

  v_current_tramo := coalesce((v_progress->>'current_tramo')::integer, 0);
  if v_progress is null then
    v_progress := pg_catalog.jsonb_build_object(
      'owner_id', p_player_id,
      'current_tramo', 0,
      'spins_remaining', 0,
      'bonus_spins_remaining', 0,
      'updated_at', null
    );
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', pc.id,
        'card_id', pc.card_id,
        'source', pc.source,
        'tramo_number', pc.tramo_number,
        'status', pc.status,
        'remaining_uses', pc.remaining_uses,
        'obtained_at', pc.obtained_at,
        'card', pg_catalog.jsonb_build_object(
          'slug', cc.slug,
          'name', cc.name,
          'category', cc.category,
          'rarity', cc.rarity,
          'description', cc.description,
          'image_path', cc.image_path,
          'uses_per_card', cc.uses_per_card,
          'target_scope', cc.target_scope,
          'disposition', cc.disposition
        )
      )
      order by
        case cc.category when 'normal' then 1 when 'tramo' then 2 else 3 end,
        case pc.status when 'available' then 1 else 2 end,
        pc.obtained_at,
        cc.name
    ),
    '[]'::jsonb
  )
  into v_inventory
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = p_player_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'type_slug', pts.type_slug,
        'is_enabled', pts.is_enabled,
        'updated_at', pts.updated_at
      )
      order by case pts.type_slug
        when 'normal' then 1 when 'fuego' then 2 when 'agua' then 3
        when 'electrico' then 4 when 'planta' then 5 when 'hielo' then 6
        when 'lucha' then 7 when 'veneno' then 8 when 'tierra' then 9
        when 'volador' then 10 when 'psiquico' then 11 when 'bicho' then 12
        when 'roca' then 13 when 'fantasma' then 14 when 'dragon' then 15
        when 'siniestro' then 16 when 'acero' then 17 when 'hada' then 18
        else 99 end
    ),
    '[]'::jsonb
  )
  into v_types
  from public.player_type_status pts
  where pts.owner_id = p_player_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', pe.id,
        'effect_key', pe.effect_key,
        'operation', pe.operation,
        'effect_value', pe.effect_value,
        'parameters', pe.parameters,
        'duration_type', pe.duration_type,
        'duration_value', pe.duration_value,
        'duration_unit', pe.duration_unit,
        'expires_at', pe.expires_at,
        'expires_after_tramo', pe.expires_after_tramo,
        'remaining_uses', pe.remaining_uses,
        'created_at', pe.created_at,
        'applied_by', pe.applied_by,
        'applied_by_name', ap.display_name,
        'source_card_name', source_cc.name,
        'source_card_image', source_cc.image_path
      )
      order by pe.created_at desc
    ),
    '[]'::jsonb
  )
  into v_effects
  from public.player_effects pe
  left join public.profiles ap on ap.id = pe.applied_by
  left join public.player_cards source_pc on source_pc.id = pe.source_card_instance_id
  left join public.card_catalog source_cc on source_cc.id = source_pc.card_id
  where pe.owner_id = p_player_id
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_current_tramo);

  select pg_catalog.jsonb_build_object(
    'cards_total', count(*),
    'cards_available', count(*) filter (where pc.status = 'available' and pc.remaining_uses > 0),
    'cards_used', count(*) filter (where pc.status = 'used' or pc.remaining_uses <= 0),
    'normal_available', count(*) filter (
      where pc.status = 'available' and pc.remaining_uses > 0
        and cc.category = 'normal' and cc.counts_toward_normal_limit = true
    ),
    'tramo_available', count(*) filter (
      where pc.status = 'available' and pc.remaining_uses > 0 and cc.category = 'tramo'
    ),
    'fiesta_available', count(*) filter (
      where pc.status = 'available' and pc.remaining_uses > 0 and cc.category = 'fiesta'
    )
  )
  into v_stats
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = p_player_id;

  return pg_catalog.jsonb_build_object(
    'trainer', pg_catalog.to_jsonb(v_profile),
    'progress', v_progress,
    'normal_card_limit', v_limit,
    'stats', coalesce(v_stats, '{}'::jsonb),
    'inventory', v_inventory,
    'types', v_types,
    'effects', v_effects
  );
end;
$function$;

create or replace function app_private.admin_clear_trainer_cards_core(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_deleted integer := 0;
  v_total integer := 0;
  v_normal integer := 0;
  v_tramo integer := 0;
  v_fiesta integer := 0;
begin
  perform app_private.require_admin();

  if p_player_id is null then
    raise exception 'Debes seleccionar un entrenador.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_player_id::text, 0)
  );

  select * into v_profile
  from public.profiles
  where id = p_player_id
  for update;

  if not found then
    raise exception 'El entrenador seleccionado ya no existe.' using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    count(*) filter (where cc.category = 'normal')::integer,
    count(*) filter (where cc.category = 'tramo')::integer,
    count(*) filter (where cc.category = 'fiesta')::integer
  into v_total, v_normal, v_tramo, v_fiesta
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = p_player_id;

  delete from public.player_cards
  where owner_id = p_player_id;

  get diagnostics v_deleted = row_count;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'trainer_id', p_player_id,
    'trainer_name', v_profile.display_name,
    'deleted_count', v_deleted,
    'deleted_normal', v_normal,
    'deleted_tramo', v_tramo,
    'deleted_fiesta', v_fiesta,
    'progress_preserved', true,
    'spins_preserved', true,
    'activity_history_preserved', true
  );
end;
$function$;

create or replace function public.admin_list_trainers()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_list_trainers_core();
$function$;

create or replace function public.admin_get_trainer(p_player_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_get_trainer_core(p_player_id);
$function$;

create or replace function public.admin_clear_trainer_cards(p_player_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_clear_trainer_cards_core(p_player_id);
$function$;

revoke all on function app_private.admin_list_trainers_core() from public, anon;
revoke all on function app_private.admin_get_trainer_core(uuid) from public, anon;
revoke all on function app_private.admin_clear_trainer_cards_core(uuid) from public, anon;
grant execute on function app_private.admin_list_trainers_core() to authenticated;
grant execute on function app_private.admin_get_trainer_core(uuid) to authenticated;
grant execute on function app_private.admin_clear_trainer_cards_core(uuid) to authenticated;

revoke all on function public.admin_list_trainers() from public, anon;
revoke all on function public.admin_get_trainer(uuid) from public, anon;
revoke all on function public.admin_clear_trainer_cards(uuid) from public, anon;
grant execute on function public.admin_list_trainers() to authenticated;
grant execute on function public.admin_get_trainer(uuid) to authenticated;
grant execute on function public.admin_clear_trainer_cards(uuid) to authenticated;
