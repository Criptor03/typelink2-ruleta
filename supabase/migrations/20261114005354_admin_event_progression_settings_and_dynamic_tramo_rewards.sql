alter table public.event_settings
  add column normal_spins_per_tramo integer not null default 3;

alter table public.event_settings
  add constraint event_settings_normal_spins_per_tramo_check
  check (normal_spins_per_tramo between 1 and 20);

create or replace function app_private.admin_get_event_progression_settings_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settings jsonb;
  v_tramo_cards jsonb;
begin
  perform app_private.require_admin();

  select pg_catalog.jsonb_build_object(
    'normal_card_limit', es.normal_card_limit,
    'cards_per_tramo', es.cards_per_tramo,
    'normal_spins_per_tramo', es.normal_spins_per_tramo,
    'updated_at', es.updated_at
  )
  into v_settings
  from public.event_settings es
  where es.singleton = true
  limit 1;

  select pg_catalog.jsonb_build_object(
    'total_count', count(*)::integer,
    'active_count', count(*) filter (where cc.is_active)::integer,
    'active_cards', coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', cc.id, 'name', cc.name, 'slug', cc.slug)
        order by cc.name
      ) filter (where cc.is_active),
      '[]'::jsonb
    )
  )
  into v_tramo_cards
  from public.card_catalog cc
  where cc.category = 'tramo';

  return pg_catalog.jsonb_build_object(
    'settings', coalesce(v_settings, '{}'::jsonb),
    'tramo_cards', coalesce(v_tramo_cards, pg_catalog.jsonb_build_object(
      'total_count', 0, 'active_count', 0, 'active_cards', '[]'::jsonb
    ))
  );
end;
$function$;

create or replace function app_private.admin_save_event_progression_settings_core(
  p_normal_card_limit integer,
  p_cards_per_tramo integer,
  p_normal_spins_per_tramo integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_active_tramo_cards integer;
begin
  perform app_private.require_admin();

  if p_normal_card_limit is null or p_normal_card_limit < 1 or p_normal_card_limit > 20 then
    raise exception 'El límite de cartas normales debe estar entre 1 y 20.'
      using errcode = '22023';
  end if;

  if p_cards_per_tramo is null or p_cards_per_tramo < 1 or p_cards_per_tramo > 10 then
    raise exception 'Las cartas entregadas por tramo deben estar entre 1 y 10.'
      using errcode = '22023';
  end if;

  if p_normal_spins_per_tramo is null or p_normal_spins_per_tramo < 1 or p_normal_spins_per_tramo > 20 then
    raise exception 'Los giros normales entregados por tramo deben estar entre 1 y 20.'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_active_tramo_cards
  from public.card_catalog cc
  where cc.category = 'tramo'
    and cc.is_active = true;

  if v_active_tramo_cards < p_cards_per_tramo then
    raise exception 'Solo hay % cartas de tramo activas. Activa o crea más cartas antes de configurar una entrega de %.',
      v_active_tramo_cards, p_cards_per_tramo
      using errcode = '22023';
  end if;

  update public.event_settings es
  set normal_card_limit = p_normal_card_limit,
      cards_per_tramo = p_cards_per_tramo,
      normal_spins_per_tramo = p_normal_spins_per_tramo,
      updated_at = pg_catalog.now()
  where es.singleton = true;

  if not found then
    raise exception 'No existe la configuración principal del evento.'
      using errcode = 'P0002';
  end if;

  return app_private.admin_get_event_progression_settings_core();
end;
$function$;

create or replace function public.admin_get_event_progression_settings()
returns jsonb
language sql
set search_path = ''
as $function$
  select app_private.admin_get_event_progression_settings_core();
$function$;

create or replace function public.admin_save_event_progression_settings(
  p_normal_card_limit integer,
  p_cards_per_tramo integer,
  p_normal_spins_per_tramo integer
)
returns jsonb
language sql
set search_path = ''
as $function$
  select app_private.admin_save_event_progression_settings_core(
    p_normal_card_limit,
    p_cards_per_tramo,
    p_normal_spins_per_tramo
  );
$function$;

revoke all on function app_private.admin_get_event_progression_settings_core() from public, anon;
revoke all on function app_private.admin_save_event_progression_settings_core(integer, integer, integer) from public, anon;
grant execute on function app_private.admin_get_event_progression_settings_core() to authenticated;
grant execute on function app_private.admin_save_event_progression_settings_core(integer, integer, integer) to authenticated;

revoke all on function public.admin_get_event_progression_settings() from public, anon;
revoke all on function public.admin_save_event_progression_settings(integer, integer, integer) from public, anon;
grant execute on function public.admin_get_event_progression_settings() to authenticated;
grant execute on function public.admin_save_event_progression_settings(integer, integer, integer) to authenticated;

create or replace function app_private.start_new_tramo_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_progress public.player_tramo_progress%rowtype;
  v_base_limit integer := 5;
  v_cards_per_tramo integer := 2;
  v_spins_per_tramo integer := 3;
  v_limit integer;
  v_limit_bonus integer := 0;
  v_normal_count integer := 0;
  v_tramo integer;
  v_previous_tramo integer;
  v_card public.card_catalog%rowtype;
  v_instance uuid;
  v_seen integer := 0;
  v_added jsonb := '[]'::jsonb;
  v_expired_effects integer := 0;
  v_auto_evolutions jsonb := pg_catalog.jsonb_build_object('count', 0, 'items', '[]'::jsonb);
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para avanzar de tramo.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  insert into public.player_tramo_progress (owner_id, current_tramo)
  select v_user, coalesce(max(pc.tramo_number), 0)
  from public.player_cards pc
  where pc.owner_id = v_user
  on conflict (owner_id) do nothing;

  select *
    into v_progress
  from public.player_tramo_progress
  where owner_id = v_user
  for update;

  if coalesce(v_progress.spins_remaining, 0) + coalesce(v_progress.bonus_spins_remaining, 0) > 0 then
    raise exception 'Aún tienes giros pendientes de este tramo. Utilízalos antes de avanzar.' using errcode = 'P0001';
  end if;

  v_previous_tramo := v_progress.current_tramo;
  v_tramo := v_progress.current_tramo + 1;

  -- Resolve automatic card evolutions before the next tramo begins.
  v_auto_evolutions := app_private.apply_tramo_evolutions_core(
    v_user, v_previous_tramo, v_tramo
  );

  select
    coalesce(es.normal_card_limit, 5),
    coalesce(es.cards_per_tramo, 2),
    coalesce(es.normal_spins_per_tramo, 3)
  into
    v_base_limit,
    v_cards_per_tramo,
    v_spins_per_tramo
  from public.event_settings es
  where es.singleton = true;

  v_base_limit := coalesce(v_base_limit, 5);
  v_cards_per_tramo := coalesce(v_cards_per_tramo, 2);
  v_spins_per_tramo := coalesce(v_spins_per_tramo, 3);

  -- Capacity is evaluated for the new tramo, excluding modifiers that expire at this boundary.
  select coalesce(sum(pe.effect_value), 0)::integer
    into v_limit_bonus
  from public.player_effects pe
  where pe.owner_id = v_user
    and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add'
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_tramo);

  v_limit := greatest(v_base_limit + v_limit_bonus, 0);

  select count(*)::integer
    into v_normal_count
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = v_user
    and pc.status = 'available'
    and pc.remaining_uses > 0
    and cc.category = 'normal'
    and cc.counts_toward_normal_limit = true;

  if v_limit - v_normal_count < v_spins_per_tramo then
    raise exception 'Te quedan cartas por utilizar. Libera al menos % espacio(s) en tu baraja antes de avanzar de tramo.',
      v_spins_per_tramo using errcode = 'P0001';
  end if;

  for v_card in
    select *
    from public.card_catalog cc
    where cc.category = 'tramo'
      and cc.is_active = true
    order by cc.slug
    limit v_cards_per_tramo
  loop
    insert into public.player_cards (
      owner_id, card_id, source, tramo_number, remaining_uses
    )
    values (
      v_user, v_card.id, 'tramo', v_tramo, v_card.uses_per_card
    )
    returning id into v_instance;

    v_seen := v_seen + 1;
    v_added := v_added || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'player_card_id', v_instance,
        'card_id', v_card.id,
        'slug', v_card.slug,
        'name', v_card.name,
        'rarity', v_card.rarity,
        'category', v_card.category,
        'description', v_card.description,
        'image_path', v_card.image_path,
        'uses_per_card', v_card.uses_per_card,
        'remaining_uses', v_card.uses_per_card,
        'tramo_number', v_tramo
      )
    );
  end loop;

  if v_seen <> v_cards_per_tramo then
    raise exception 'El catálogo debe tener % cartas de tramo activas.',
      v_cards_per_tramo using errcode = 'P0002';
  end if;

  -- End stage-scoped effects. Permanent, timed and charge-based effects are preserved.
  update public.player_effects pe
    set status = 'expired', remaining_uses = 0
  where pe.owner_id = v_user
    and pe.status = 'active'
    and (
      pe.duration_type = 'tramo_end'
      or (pe.expires_after_tramo is not null and pe.expires_after_tramo < v_tramo)
    );
  get diagnostics v_expired_effects = row_count;

  update public.player_tramo_progress
    set current_tramo = v_tramo,
        spins_remaining = v_spins_per_tramo,
        bonus_spins_remaining = 0,
        updated_at = pg_catalog.now()
  where owner_id = v_user;

  insert into public.card_activity (actor_id, activity_type, details)
  values (
    v_user,
    'tramo_award',
    pg_catalog.jsonb_build_object(
      'tramo_number', v_tramo,
      'normal_spins_granted', v_spins_per_tramo,
      'cards', v_added,
      'automatic_evolutions', v_auto_evolutions,
      'effects_expired', v_expired_effects
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'tramo_number', v_tramo,
    'normal_spins_remaining', v_spins_per_tramo,
    'bonus_spins_remaining', 0,
    'effects_expired', v_expired_effects,
    'cards', v_added,
    'automatic_evolutions', v_auto_evolutions->'items',
    'automatic_evolutions_count', v_auto_evolutions->'count'
  );
end;
$function$;
