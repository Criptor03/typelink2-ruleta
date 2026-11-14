alter table public.card_catalog
  add column if not exists allow_no_effect_play boolean not null default false;

comment on column public.card_catalog.allow_no_effect_play is
  'Permite jugar esta carta aunque no tenga efectos automáticos activos; el uso se registra normalmente.';

update public.card_catalog
set allow_no_effect_play = true
where slug = 'nada';

CREATE OR REPLACE FUNCTION app_private.admin_save_card_core(p_card jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_existing public.card_catalog%rowtype;
  v_saved public.card_catalog%rowtype;
  v_slug text;
  v_name text;
  v_category text;
  v_rarity text;
  v_description text;
  v_image_path text;
  v_target_scope text;
  v_disposition text;
  v_uses integer;
  v_is_active boolean;
  v_counts_toward_normal_limit boolean;
  v_roulette_eligible boolean;
  v_allow_no_effect_play boolean;
begin
  perform app_private.require_admin();
  if p_card is null or pg_catalog.jsonb_typeof(p_card) <> 'object' then
    raise exception 'Los datos de la carta no son válidos.' using errcode = '22023';
  end if;
  if nullif(p_card->>'id', '') is not null then
    v_id := (p_card->>'id')::uuid;
    select * into v_existing from public.card_catalog where id = v_id for update;
    if not found then
      raise exception 'No encontramos la carta que intentas editar.' using errcode = 'P0002';
    end if;
  end if;

  v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'slug', '')));
  v_name := pg_catalog.btrim(coalesce(p_card->>'name', ''));
  v_category := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'category', '')));
  v_rarity := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'rarity', '')));
  v_description := coalesce(p_card->>'description', '');
  v_image_path := nullif(pg_catalog.btrim(coalesce(p_card->>'image_path', '')), '');
  v_target_scope := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'target_scope', 'self')));
  v_disposition := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'disposition', 'consume')));
  v_uses := coalesce(nullif(p_card->>'uses_per_card', '')::integer, 1);
  v_is_active := coalesce(nullif(p_card->>'is_active', '')::boolean, true);
  v_counts_toward_normal_limit := coalesce(nullif(p_card->>'counts_toward_normal_limit', '')::boolean, true);
  v_roulette_eligible := coalesce(nullif(p_card->>'roulette_eligible', '')::boolean, true);
  v_allow_no_effect_play := coalesce(nullif(p_card->>'allow_no_effect_play', '')::boolean, false);

  if v_name = '' or pg_catalog.length(v_name) > 80 then
    raise exception 'El nombre debe tener entre 1 y 80 caracteres.' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or pg_catalog.length(v_slug) > 64 then
    raise exception 'El identificador solo puede usar letras minúsculas, números y guiones.' using errcode = '22023';
  end if;
  if v_category not in ('normal', 'tramo', 'fiesta') then
    raise exception 'La categoría seleccionada no es válida.' using errcode = '22023';
  end if;
  if not (
    (v_category = 'normal' and v_rarity in ('common', 'rare', 'epic', 'legendary'))
    or (v_category = 'tramo' and v_rarity = 'tramo')
    or (v_category = 'fiesta' and v_rarity = 'fiesta')
  ) then
    raise exception 'La rareza no corresponde con la categoría seleccionada.' using errcode = '22023';
  end if;
  if v_uses < 1 or v_uses > 99 then
    raise exception 'Los usos por carta deben estar entre 1 y 99.' using errcode = '22023';
  end if;
  if v_target_scope not in ('self', 'opponent') then
    raise exception 'El objetivo debe ser quien utiliza la carta o un rival.' using errcode = '22023';
  end if;
  if v_roulette_eligible and v_id is not null and exists (
    select 1 from public.card_evolution_rules er
    where er.source_card_id = v_id and er.is_active = true
  ) then
    raise exception 'Esta carta tiene una evolución activa y no puede aparecer en la ruleta.' using errcode = '22023';
  end if;
  if v_disposition not in ('consume', 'transfer') then
    raise exception 'El comportamiento de canje seleccionado no es válido.' using errcode = '22023';
  end if;
  if pg_catalog.length(v_description) > 1000 then
    raise exception 'La descripción no puede superar los 1000 caracteres.' using errcode = '22023';
  end if;
  if v_image_path is not null
     and v_image_path not like 'assets/%'
     and v_image_path not like 'https://uytdmfrynuzofkyedhve.supabase.co/storage/v1/object/public/typelink-card-art/cards/%' then
    raise exception 'La ilustración debe ser un recurso del proyecto o una imagen del almacén oficial.' using errcode = '22023';
  end if;
  if v_category <> 'normal' then
    v_counts_toward_normal_limit := false;
  end if;

  if v_id is not null then
    if v_slug <> v_existing.slug then
      raise exception 'El identificador interno no se puede cambiar después de crear la carta.' using errcode = '22023';
    end if;
    if v_category is distinct from v_existing.category and (
      exists (select 1 from public.player_cards pc where pc.card_id = v_id)
      or exists (select 1 from public.roulette_pool_cards rpc where rpc.card_id = v_id)
      or exists (select 1 from public.card_effects ce where ce.card_id = v_id)
      or exists (select 1 from public.card_evolution_rules er where er.source_card_id = v_id or er.result_card_id = v_id)
    ) then
      raise exception 'No se puede cambiar la categoría: esta carta ya está conectada a inventarios o mecánicas del evento.' using errcode = '23000';
    end if;
    update public.card_catalog
    set name = v_name, category = v_category, rarity = v_rarity,
        description = v_description, image_path = v_image_path,
        is_active = v_is_active, target_scope = v_target_scope,
        disposition = v_disposition,
        counts_toward_normal_limit = v_counts_toward_normal_limit,
        uses_per_card = v_uses,
        roulette_eligible = v_roulette_eligible,
        allow_no_effect_play = v_allow_no_effect_play
    where id = v_id
    returning * into v_saved;
  else
    insert into public.card_catalog (
      slug, name, category, rarity, description, image_path, is_active,
      target_scope, disposition, counts_toward_normal_limit, uses_per_card, roulette_eligible, allow_no_effect_play
    )
    values (
      v_slug, v_name, v_category, v_rarity, v_description, v_image_path, v_is_active,
      v_target_scope, v_disposition, v_counts_toward_normal_limit, v_uses, v_roulette_eligible, v_allow_no_effect_play
    )
    returning * into v_saved;
  end if;
  if not v_roulette_eligible then
    delete from public.roulette_pool_cards where card_id = v_saved.id;
  end if;
  return pg_catalog.to_jsonb(v_saved);
end;
$function$
;

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
    cc.allow_no_effect_play,
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

  if v_effect_count = 0 and not v_card.allow_no_effect_play then
    raise exception 'Esta carta todavía no tiene efectos configurados y no permite un uso sin efecto automático.' using errcode = 'P0001';
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
      where rp.slug = v_effect.parameters ->> 'pool_slug';

      if v_pool_id is null then
        raise exception 'La ruleta solicitada no está configurada.' using errcode = 'P0002';
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
          'card_name', v_card.name,
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
;
