-- TypeLink 2 card play runtime.
-- Applied to the active Supabase project after the universal card-engine schema.
alter table public.card_effects
  add column if not exists duration_unit text not null default 'hours';
alter table public.player_effects
  add column if not exists duration_unit text not null default 'hours';

alter table public.card_effects
  drop constraint if exists card_effects_duration_unit_check;
alter table public.card_effects
  add constraint card_effects_duration_unit_check
  check (duration_unit in ('seconds', 'minutes', 'hours', 'days'));
alter table public.player_effects
  drop constraint if exists player_effects_duration_unit_check;
alter table public.player_effects
  add constraint player_effects_duration_unit_check
  check (duration_unit in ('seconds', 'minutes', 'hours', 'days'));

create table if not exists public.event_effects (
  id uuid primary key default gen_random_uuid(),
  source_card_instance_id uuid references public.player_cards(id) on delete set null,
  applied_by uuid references public.profiles(id) on delete set null,
  effect_key text not null check (length(btrim(effect_key)) > 0),
  operation text not null check (operation in ('add', 'set', 'multiply', 'toggle', 'grant', 'block')),
  effect_value numeric,
  parameters jsonb not null default '{}'::jsonb,
  duration_type text not null check (duration_type in ('instant', 'tramo_end', 'next_tramo_end', 'match_end', 'timed', 'charges', 'permanent')),
  duration_value integer check (duration_value is null or duration_value > 0),
  duration_unit text not null default 'hours' check (duration_unit in ('seconds', 'minutes', 'hours', 'days')),
  expires_at timestamptz,
  expires_after_tramo integer check (expires_after_tramo is null or expires_after_tramo >= 0),
  remaining_uses integer check (remaining_uses is null or remaining_uses >= 0),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists event_effects_active_key_idx
  on public.event_effects(effect_key, status, expires_at) where status = 'active';
create index if not exists event_effects_source_card_idx
  on public.event_effects(source_card_instance_id);

alter table public.event_effects enable row level security;
revoke all on table public.event_effects from anon, authenticated;
grant select on table public.event_effects to authenticated;
create policy "Signed-in users can view active event effects"
  on public.event_effects for select to authenticated using (status = 'active');

CREATE OR REPLACE FUNCTION app_private.draw_random_card_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_base_limit integer;
  v_current_tramo integer;
  v_bonus integer := 0;
  v_limit integer;
  v_count integer;
  v_card public.card_catalog%rowtype;
  v_instance uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para girar la ruleta.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select normal_card_limit, current_tramo
    into v_base_limit, v_current_tramo
  from public.event_settings
  where singleton = true;

  v_base_limit := coalesce(v_base_limit, 5);
  v_current_tramo := coalesce(v_current_tramo, 0);

  select coalesce(sum(pe.effect_value), 0)::integer
    into v_bonus
  from public.player_effects pe
  where pe.owner_id = v_user
    and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add'
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_current_tramo);

  v_limit := greatest(v_base_limit + v_bonus, 0);

  select count(*) into v_count
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = v_user
    and pc.status = 'available'
    and cc.counts_toward_normal_limit = true;

  if v_count >= v_limit then
    raise exception 'Tu baraja está completa. Tu límite efectivo es de % cartas normales.', v_limit using errcode = 'P0001';
  end if;

  select * into v_card
  from public.card_catalog
  where category = 'normal' and is_active = true
  order by pg_catalog.random()
  limit 1;

  if not found then
    raise exception 'No hay cartas normales activas en el catálogo.' using errcode = 'P0002';
  end if;

  insert into public.player_cards(owner_id, card_id, source)
  values (v_user, v_card.id, 'roulette')
  returning id into v_instance;

  return pg_catalog.jsonb_build_object(
    'player_card_id', v_instance,
    'card_id', v_card.id,
    'slug', v_card.slug,
    'name', v_card.name,
    'rarity', v_card.rarity,
    'category', v_card.category,
    'description', v_card.description,
    'image_path', v_card.image_path,
    'obtained_at', pg_catalog.now(),
    'normal_count', v_count + 1,
    'normal_limit_base', v_base_limit,
    'normal_limit_bonus', v_bonus,
    'normal_limit', v_limit
  );
end;
$function$


CREATE OR REPLACE FUNCTION app_private.play_card_core(p_card_instance_id uuid, p_target_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_card record;
  v_effect record;
  v_target_id uuid;
  v_effect_target_id uuid;
  v_lock_id uuid;
  v_pool_id uuid;
  v_current_tramo integer := 0;
  v_expires_at timestamptz;
  v_expires_after_tramo integer;
  v_remaining_uses integer;
  v_effect_count integer := 0;
  v_applied_count integer := 0;
  v_recipient_count integer := 0;
  v_unlock_count integer := 0;
  v_effects jsonb := '[]'::jsonb;
  v_unlocks jsonb := '[]'::jsonb;
  v_unit text;
  v_spins integer;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para jugar una carta.' using errcode = '28000';
  end if;

  if p_card_instance_id is null then
    raise exception 'Debes indicar qué carta quieres jugar.' using errcode = '22023';
  end if;

  select
    pc.id as instance_id,
    pc.owner_id,
    pc.card_id,
    pc.status,
    cc.slug,
    cc.name,
    cc.rarity,
    cc.category,
    cc.description,
    cc.image_path,
    cc.target_scope,
    cc.disposition,
    cc.counts_toward_normal_limit,
    pc.tramo_number
  into v_card
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.id = p_card_instance_id
  for update of pc;

  if not found then
    raise exception 'No encontramos esa carta en el inventario.' using errcode = 'P0002';
  end if;

  if v_card.owner_id <> v_user then
    raise exception 'Solo puedes jugar cartas que pertenecen a tu inventario.' using errcode = '42501';
  end if;

  if v_card.status <> 'available' then
    raise exception 'Esta carta ya fue utilizada y no está disponible.' using errcode = 'P0001';
  end if;

  -- Resolve the destination from the card's own targeting rule.
  case v_card.target_scope
    when 'self' then
      if p_target_id is not null and p_target_id <> v_user then
        raise exception 'Esta carta solo puede aplicarse a ti mismo.' using errcode = '22023';
      end if;
      v_target_id := v_user;

    when 'opponent' then
      if p_target_id is null or p_target_id = v_user then
        raise exception 'Debes elegir a otro entrenador como objetivo.' using errcode = '22023';
      end if;
      v_target_id := p_target_id;

    when 'either' then
      v_target_id := coalesce(p_target_id, v_user);

    when 'all_players' then
      if p_target_id is not null then
        raise exception 'Esta carta afecta a todos los entrenadores y no admite un objetivo individual.' using errcode = '22023';
      end if;
      v_target_id := null;

    when 'event' then
      if p_target_id is not null then
        raise exception 'Esta carta afecta al evento y no admite un objetivo individual.' using errcode = '22023';
      end if;
      v_target_id := null;

    when 'none' then
      if p_target_id is not null then
        raise exception 'Esta carta no admite un objetivo individual.' using errcode = '22023';
      end if;
      v_target_id := null;

    else
      raise exception 'El tipo de objetivo de esta carta no está configurado.' using errcode = '22023';
  end case;

  if v_card.target_scope in ('opponent', 'either') and v_target_id is not null then
    if not exists (select 1 from public.profiles p where p.id = v_target_id) then
      raise exception 'El entrenador seleccionado no existe.' using errcode = 'P0002';
    end if;
  end if;

  -- Acquire affected-player locks in a deterministic order to reduce deadlocks.
  for v_lock_id in
    select distinct ids.id
    from unnest(array[v_user, v_target_id]) as ids(id)
    where ids.id is not null
    order by ids.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_lock_id::text, 0)
    );
  end loop;

  select coalesce(es.current_tramo, 0)
    into v_current_tramo
  from public.event_settings es
  where es.singleton = true;

  select count(*) into v_effect_count
  from public.card_effects ce
  where ce.card_id = v_card.card_id
    and ce.is_active = true;

  -- A transfer moves the physical card; it does not trigger its attached effect.
  if v_card.disposition = 'transfer' then
    if v_card.target_scope not in ('opponent', 'either')
       or v_target_id is null
       or v_target_id = v_user then
      raise exception 'Para transferir una carta debes elegir a otro entrenador.' using errcode = '22023';
    end if;

    if v_effect_count > 0 then
      raise exception 'Una carta transferible no puede tener efectos de uso configurados.' using errcode = '22023';
    end if;

    update public.player_cards
      set owner_id = v_target_id
    where id = v_card.instance_id;

    insert into public.card_activity (
      actor_id, target_id, card_instance_id, activity_type, details
    )
    values (
      v_user, v_target_id, v_card.instance_id, 'transfer',
      pg_catalog.jsonb_build_object(
        'card_slug', v_card.slug,
        'card_name', v_card.name,
        'rarity', v_card.rarity,
        'image_path', v_card.image_path,
        'from_owner_id', v_user,
        'to_owner_id', v_target_id
      )
    );

    return pg_catalog.jsonb_build_object(
      'success', true,
      'action', 'transfer',
      'card_instance_id', v_card.instance_id,
      'card_id', v_card.card_id,
      'slug', v_card.slug,
      'name', v_card.name,
      'rarity', v_card.rarity,
      'category', v_card.category,
      'description', v_card.description,
      'image_path', v_card.image_path,
      'target_id', v_target_id,
      'disposition', v_card.disposition,
      'status', 'available'
    );
  end if;

  if v_effect_count = 0 then
    raise exception 'Esta carta todavía no tiene efectos configurados y no se puede jugar.' using errcode = 'P0001';
  end if;

  for v_effect in
    select *
    from public.card_effects ce
    where ce.card_id = v_card.card_id
      and ce.is_active = true
    order by ce.sort_order, ce.created_at, ce.id
  loop
    if v_effect.effect_key = 'unlock_roulette' then
      if v_effect.operation <> 'grant'
         or v_card.target_scope not in ('none', 'self')
         or v_card.disposition <> 'consume' then
        raise exception 'La carta de acceso a ruleta no tiene una configuración válida.' using errcode = '22023';
      end if;

      select rp.id into v_pool_id
      from public.roulette_pools rp
      where rp.slug = v_effect.parameters ->> 'pool_slug'
        and rp.is_active = true;

      if v_pool_id is null then
        raise exception 'La ruleta solicitada no existe o está desactivada.' using errcode = 'P0002';
      end if;

      v_spins := coalesce((v_effect.parameters ->> 'spins_granted')::integer, 1);
      if v_spins < 1 or v_spins > 100 then
        raise exception 'La cantidad de giros desbloqueados debe estar entre 1 y 100.' using errcode = '22023';
      end if;

      insert into public.player_roulette_unlocks (
        owner_id, pool_id, source_card_instance_id, spins_granted
      )
      values (
        v_user, v_pool_id, v_card.instance_id, v_spins
      );

      v_unlock_count := v_unlock_count + 1;
      v_unlocks := v_unlocks || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'pool_slug', v_effect.parameters ->> 'pool_slug',
          'spins_granted', v_spins
        )
      );

      insert into public.card_activity (
        actor_id, card_instance_id, activity_type, details
      )
      values (
        v_user, v_card.instance_id, 'roulette_unlock',
        pg_catalog.jsonb_build_object(
          'pool_slug', v_effect.parameters ->> 'pool_slug',
          'spins_granted', v_spins,
          'card_slug', v_card.slug,
          'image_path', v_card.image_path
        )
      );

      v_applied_count := v_applied_count + 1;
      v_effects := v_effects || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'effect_key', v_effect.effect_key,
          'operation', v_effect.operation,
          'pool_slug', v_effect.parameters ->> 'pool_slug'
        )
      );
      continue;
    end if;

    if v_card.target_scope = 'none' then
      raise exception 'Esta carta necesita un efecto de acceso compatible con su objetivo.' using errcode = '22023';
    end if;

    if v_effect.duration_type = 'instant' then
      raise exception 'El efecto instantáneo % necesita su propio controlador antes de poder utilizarse.', v_effect.effect_key
        using errcode = '0A000';
    end if;

    if v_effect.duration_type in ('timed', 'charges')
       and (v_effect.duration_value is null or v_effect.duration_value < 1) then
      raise exception 'El efecto % necesita una duración mayor que cero.', v_effect.effect_key using errcode = '22023';
    end if;

    v_expires_at := null;
    v_expires_after_tramo := null;
    v_remaining_uses := null;
    v_unit := coalesce(v_effect.duration_unit, 'hours');

    if v_effect.duration_type = 'timed' then
      v_expires_at := pg_catalog.now() + case v_unit
        when 'seconds' then pg_catalog.make_interval(secs => v_effect.duration_value::double precision)
        when 'minutes' then pg_catalog.make_interval(mins => v_effect.duration_value)
        when 'hours' then pg_catalog.make_interval(hours => v_effect.duration_value)
        when 'days' then pg_catalog.make_interval(days => v_effect.duration_value)
      end;
    elsif v_effect.duration_type = 'charges' then
      v_remaining_uses := v_effect.duration_value;
    elsif v_effect.duration_type = 'tramo_end' then
      v_expires_after_tramo := v_current_tramo;
    elsif v_effect.duration_type = 'next_tramo_end' then
      v_expires_after_tramo := v_current_tramo + 1;
    end if;

    if v_effect.effect_key = 'normal_card_limit'
       and (v_card.target_scope in ('event', 'all_players')
            or v_effect.operation <> 'add'
            or v_effect.effect_value is null
            or v_effect.effect_value <> pg_catalog.trunc(v_effect.effect_value)) then
      raise exception 'El modificador del límite de baraja debe ser un número entero aditivo para un entrenador.' using errcode = '22023';
    end if;

    if v_card.target_scope = 'event' then
      insert into public.event_effects (
        source_card_instance_id, applied_by, effect_key, operation,
        effect_value, parameters, duration_type, duration_value, duration_unit,
        expires_at, expires_after_tramo, remaining_uses
      )
      values (
        v_card.instance_id, v_user, v_effect.effect_key, v_effect.operation,
        v_effect.effect_value, v_effect.parameters, v_effect.duration_type,
        v_effect.duration_value, v_unit, v_expires_at,
        v_expires_after_tramo, v_remaining_uses
      );

      v_recipient_count := 1;
    elsif v_card.target_scope = 'all_players' then
      for v_effect_target_id in
        select p.id from public.profiles p order by p.id
      loop
        insert into public.player_effects (
          owner_id, applied_by, source_card_instance_id, effect_key, operation,
          effect_value, parameters, duration_type, duration_value, duration_unit,
          expires_at, expires_after_tramo, remaining_uses
        )
        values (
          v_effect_target_id, v_user, v_card.instance_id, v_effect.effect_key, v_effect.operation,
          v_effect.effect_value, v_effect.parameters, v_effect.duration_type, v_effect.duration_value,
          v_unit, v_expires_at, v_expires_after_tramo, v_remaining_uses
        );

        v_recipient_count := v_recipient_count + 1;
      end loop;
    else
      insert into public.player_effects (
        owner_id, applied_by, source_card_instance_id, effect_key, operation,
        effect_value, parameters, duration_type, duration_value, duration_unit,
        expires_at, expires_after_tramo, remaining_uses
      )
      values (
        v_target_id, v_user, v_card.instance_id, v_effect.effect_key, v_effect.operation,
        v_effect.effect_value, v_effect.parameters, v_effect.duration_type, v_effect.duration_value,
        v_unit, v_expires_at, v_expires_after_tramo, v_remaining_uses
      );

      v_recipient_count := 1;
    end if;

    v_applied_count := v_applied_count + 1;
    v_effects := v_effects || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'effect_key', v_effect.effect_key,
        'operation', v_effect.operation,
        'effect_value', v_effect.effect_value,
        'duration_type', v_effect.duration_type,
        'duration_value', v_effect.duration_value,
        'duration_unit', v_unit,
        'recipient_count', v_recipient_count
      )
    );

    insert into public.card_activity (
      actor_id, target_id, card_instance_id, activity_type, details
    )
    values (
      v_user, v_target_id, v_card.instance_id, 'effect_applied',
      pg_catalog.jsonb_build_object(
        'card_slug', v_card.slug,
        'effect_key', v_effect.effect_key,
        'operation', v_effect.operation,
        'effect_value', v_effect.effect_value,
        'duration_type', v_effect.duration_type,
        'recipient_count', v_recipient_count,
        'image_path', v_card.image_path
      )
    );
    v_recipient_count := 0;
  end loop;

  insert into public.card_activity (
    actor_id, target_id, card_instance_id, activity_type, details
  )
  values (
    v_user, v_target_id, v_card.instance_id, 'play',
    pg_catalog.jsonb_build_object(
      'card_slug', v_card.slug,
      'card_name', v_card.name,
      'rarity', v_card.rarity,
      'category', v_card.category,
      'image_path', v_card.image_path,
      'target_scope', v_card.target_scope,
      'disposition', v_card.disposition,
      'effect_count', v_applied_count,
      'unlock_count', v_unlock_count
    )
  );

  if v_card.disposition = 'consume' then
    update public.player_cards
      set status = 'used'
    where id = v_card.instance_id;

    insert into public.card_activity (
      actor_id, target_id, card_instance_id, activity_type, details
    )
    values (
      v_user, v_target_id, v_card.instance_id, 'consume',
      pg_catalog.jsonb_build_object(
        'card_slug', v_card.slug,
        'card_name', v_card.name,
        'image_path', v_card.image_path
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'action', 'play',
    'card_instance_id', v_card.instance_id,
    'card_id', v_card.card_id,
    'slug', v_card.slug,
    'name', v_card.name,
    'rarity', v_card.rarity,
    'category', v_card.category,
    'description', v_card.description,
    'image_path', v_card.image_path,
    'target_scope', v_card.target_scope,
    'disposition', v_card.disposition,
    'status', case when v_card.disposition = 'consume' then 'used' else 'available' end,
    'target_id', v_target_id,
    'effects_applied', v_effects,
    'roulette_unlocks', v_unlocks
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.play_card(p_card_instance_id uuid, p_target_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.play_card_core(p_card_instance_id, p_target_id);
$function$


revoke execute on function public.play_card(uuid, uuid) from public, anon;
grant execute on function public.play_card(uuid, uuid) to authenticated;
revoke execute on function app_private.play_card_core(uuid, uuid) from public, anon;
grant execute on function app_private.play_card_core(uuid, uuid) to authenticated;
