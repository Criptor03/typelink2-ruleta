CREATE OR REPLACE FUNCTION app_private.draw_normal_card_with_tramo_credit_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_progress public.player_tramo_progress%rowtype;
  v_base_limit integer;
  v_limit integer;
  v_limit_bonus integer := 0;
  v_normal_count integer := 0;
  v_card public.card_catalog%rowtype;
  v_instance uuid;
  v_selected_weight integer := 1;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para girar la ruleta.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select *
    into v_progress
  from public.player_tramo_progress
  where owner_id = v_user
  for update;

  if not found
     or coalesce(v_progress.spins_remaining, 0) + coalesce(v_progress.bonus_spins_remaining, 0) < 1 then
    raise exception 'No tienes giros disponibles. Avanza de tramo para recibir los giros configurados.' using errcode = 'P0001';
  end if;

  select es.normal_card_limit
    into v_base_limit
  from public.event_settings es
  where es.singleton = true;
  v_base_limit := coalesce(v_base_limit, 5);

  select coalesce(sum(pe.effect_value), 0)::integer
    into v_limit_bonus
  from public.player_effects pe
  where pe.owner_id = v_user
    and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add'
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_progress.current_tramo);

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

  if v_normal_count >= v_limit then
    raise exception 'Tu baraja está completa. Tu límite efectivo es de % cartas normales.', v_limit using errcode = 'P0001';
  end if;

  select cc.*
    into v_card
  from public.roulette_pools rp
  join public.roulette_pool_cards rpc on rpc.pool_id = rp.id
  join public.card_catalog cc on cc.id = rpc.card_id
  where rp.slug = 'normal'
    and rp.is_active = true
    and rpc.is_active = true
    and cc.category = 'normal'
    and cc.rarity <> 'legendary'
    and cc.is_active = true
    and cc.roulette_eligible = true
    and not exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = cc.id and er.is_active = true
    )
  order by pg_catalog.random() ^ (1.0 / rpc.weight) desc
  limit 1;

  if not found then
    raise exception 'La ruleta normal no tiene cartas activas. Configúrala desde Administración → Ruletas.' using errcode = 'P0002';
  end if;

  select rpc.weight into v_selected_weight
  from public.roulette_pool_cards rpc
  join public.roulette_pools rp on rp.id = rpc.pool_id
  where rp.slug = 'normal' and rpc.card_id = v_card.id;

  insert into public.player_cards (owner_id, card_id, source, tramo_number, remaining_uses)
  values (v_user, v_card.id, 'roulette', v_progress.current_tramo, v_card.uses_per_card)
  returning id into v_instance;

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

  insert into public.card_activity (
    actor_id, card_instance_id, activity_type, details
  )
  values (
    v_user, v_instance, 'roulette_spin',
    pg_catalog.jsonb_build_object(
      'tramo_number', v_progress.current_tramo,
      'card_slug', v_card.slug,
      'card_name', v_card.name,
      'rarity', v_card.rarity,
      'image_path', v_card.image_path,
      'roulette_pool', 'normal',
      'roulette_weight', v_selected_weight,
      'normal_spins_remaining', v_progress.spins_remaining,
      'bonus_spins_remaining', v_progress.bonus_spins_remaining
    )
  );

  return pg_catalog.jsonb_build_object(
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
    'obtained_at', pg_catalog.now(),
    'normal_count', v_normal_count + 1,
    'normal_limit_base', v_base_limit,
    'normal_limit_bonus', v_limit_bonus,
    'normal_limit', v_limit,
    'tramo_number', v_progress.current_tramo,
    'normal_spins_remaining', v_progress.spins_remaining,
    'bonus_spins_remaining', v_progress.bonus_spins_remaining,
    'roulette_pool', 'normal',
    'roulette_weight', v_selected_weight
  );
end;
$function$
