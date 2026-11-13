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
  v_unlocks jsonb;
  v_activity jsonb;
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

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', pru.id,
        'pool_slug', rp.slug,
        'pool_name', rp.name,
        'pool_type', rp.pool_type,
        'spins_granted', pru.spins_granted,
        'spins_used', pru.spins_used,
        'spins_remaining', greatest(pru.spins_granted - pru.spins_used, 0),
        'expires_at', pru.expires_at,
        'created_at', pru.created_at
      )
      order by pru.created_at desc
    ),
    '[]'::jsonb
  )
  into v_unlocks
  from public.player_roulette_unlocks pru
  join public.roulette_pools rp on rp.id = pru.pool_id
  where pru.owner_id = p_player_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', recent.id,
        'activity_type', recent.activity_type,
        'details', recent.details,
        'created_at', recent.created_at,
        'actor_name', recent.actor_name,
        'target_name', recent.target_name,
        'card_name', recent.card_name
      )
      order by recent.created_at desc
    ),
    '[]'::jsonb
  )
  into v_activity
  from (
    select
      ca.id,
      ca.activity_type,
      ca.details,
      ca.created_at,
      actor.display_name as actor_name,
      target.display_name as target_name,
      coalesce(cc.name, ca.details->>'card_name', ca.details->>'name') as card_name
    from public.card_activity ca
    left join public.profiles actor on actor.id = ca.actor_id
    left join public.profiles target on target.id = ca.target_id
    left join public.player_cards pc on pc.id = ca.card_instance_id
    left join public.card_catalog cc on cc.id = pc.card_id
    where ca.actor_id = p_player_id or ca.target_id = p_player_id
    order by ca.created_at desc
    limit 20
  ) recent;

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
    'effects', v_effects,
    'unlocks', v_unlocks,
    'activity', v_activity
  );
end;
$function$;
