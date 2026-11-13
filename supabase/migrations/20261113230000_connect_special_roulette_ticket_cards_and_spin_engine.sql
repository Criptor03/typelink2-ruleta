WITH ticket_cards AS (
  INSERT INTO public.card_catalog(
    slug,name,category,rarity,description,image_path,is_active,target_scope,
    disposition,counts_toward_normal_limit,uses_per_card,roulette_eligible
  )
  VALUES
    ('legenleta','Legenleta','normal','common',
      'Al canjear esta carta, obtienes 1 giro de acceso a la Ruleta Legendaria.',
      NULL,true,'self','consume',true,1,true),
    ('rumba','Rumba','normal','common',
      'Al canjear esta carta, obtienes 1 giro de acceso a la Ruleta Fiesta.',
      NULL,true,'self','consume',true,1,true)
  ON CONFLICT (slug) DO UPDATE SET
    name=excluded.name,
    category='normal',
    rarity='common',
    description=excluded.description,
    is_active=true,
    target_scope='self',
    disposition='consume',
    counts_toward_normal_limit=true,
    uses_per_card=1,
    roulette_eligible=true
  RETURNING id,slug
)
INSERT INTO public.card_effects(
  card_id,effect_key,operation,effect_value,parameters,duration_type,
  duration_value,duration_unit,sort_order,is_active
)
SELECT
  tc.id,'unlock_roulette','grant',NULL,
  case tc.slug
    when 'legenleta' then jsonb_build_object('pool_slug','legendary','spins_granted',1)
    else jsonb_build_object('pool_slug','fiesta','spins_granted',1)
  end,
  'instant',NULL,'hours',0,true
FROM ticket_cards tc;

INSERT INTO public.roulette_pool_cards(pool_id,card_id,weight,is_active)
SELECT rp.id,cc.id,1,true
FROM public.roulette_pools rp
JOIN public.card_catalog cc ON cc.slug IN ('legenleta','rumba')
WHERE rp.slug='normal'
ON CONFLICT (pool_id,card_id) DO UPDATE
SET weight=excluded.weight,is_active=true;

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

CREATE OR REPLACE FUNCTION app_private.draw_special_roulette_card_core(p_pool_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_pool public.roulette_pools%rowtype;
  v_unlock_id uuid;
  v_card public.card_catalog%rowtype;
  v_progress_tramo integer := 0;
  v_base_limit integer := 5;
  v_limit_bonus integer := 0;
  v_limit integer := 5;
  v_normal_count integer := 0;
  v_selected_weight integer := 1;
  v_instance uuid;
  v_access_remaining integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para usar una ruleta especial.' using errcode = '28000';
  end if;

  if p_pool_slug not in ('legendary','fiesta') then
    raise exception 'La ruleta especial seleccionada no es válida.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select *
    into v_pool
  from public.roulette_pools rp
  where rp.slug = p_pool_slug
    and rp.is_active = true
  for share;

  if not found then
    raise exception 'La Ruleta % todavía no está abierta.', case when p_pool_slug='legendary' then 'Legendaria' else 'Fiesta' end
      using errcode = 'P0001';
  end if;

  select pu.id
    into v_unlock_id
  from public.player_roulette_unlocks pu
  where pu.owner_id = v_user
    and pu.pool_id = v_pool.id
    and pu.spins_used < pu.spins_granted
    and (pu.expires_at is null or pu.expires_at > pg_catalog.now())
  order by pu.created_at, pu.id
  limit 1
  for update skip locked;

  if v_unlock_id is null then
    raise exception 'No tienes giros disponibles en la Ruleta %.', case when p_pool_slug='legendary' then 'Legendaria' else 'Fiesta' end
      using errcode = 'P0001';
  end if;

  select coalesce(ptp.current_tramo,0)
    into v_progress_tramo
  from public.player_tramo_progress ptp
  where ptp.owner_id = v_user
  for update;

  v_progress_tramo := coalesce(v_progress_tramo,0);

  select coalesce(es.normal_card_limit,5)
    into v_base_limit
  from public.event_settings es
  where es.singleton = true;
  v_base_limit := coalesce(v_base_limit,5);

  select coalesce(sum(pe.effect_value),0)::integer
    into v_limit_bonus
  from public.player_effects pe
  where pe.owner_id = v_user
    and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add'
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_progress_tramo);

  v_limit := greatest(v_base_limit + v_limit_bonus,0);

  select cc.*
    into v_card
  from public.roulette_pool_cards rpc
  join public.card_catalog cc on cc.id = rpc.card_id
  where rpc.pool_id = v_pool.id
    and rpc.is_active = true
    and cc.is_active = true
    and cc.roulette_eligible = true
    and not exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = cc.id and er.is_active = true
    )
    and (
      (p_pool_slug='legendary' and cc.category='normal' and cc.rarity='legendary')
      or (p_pool_slug='fiesta' and cc.category='fiesta')
    )
  order by pg_catalog.random() ^ (1.0 / greatest(rpc.weight,1)) desc
  limit 1;

  if not found then
    raise exception 'La Ruleta % no tiene premios activos configurados.', case when p_pool_slug='legendary' then 'Legendaria' else 'Fiesta' end
      using errcode = 'P0002';
  end if;

  if v_card.category='normal' and v_card.counts_toward_normal_limit then
    select count(*)::integer
      into v_normal_count
    from public.player_cards pc
    join public.card_catalog cc on cc.id=pc.card_id
    where pc.owner_id=v_user
      and pc.status='available'
      and pc.remaining_uses > 0
      and cc.category='normal'
      and cc.counts_toward_normal_limit=true;

    if v_normal_count >= v_limit then
      raise exception 'Tu baraja está completa. Libera espacio antes de girar la Ruleta Legendaria.'
        using errcode = 'P0001';
    end if;
  end if;

  select rpc.weight
    into v_selected_weight
  from public.roulette_pool_cards rpc
  where rpc.pool_id=v_pool.id and rpc.card_id=v_card.id;

  update public.player_roulette_unlocks
    set spins_used=spins_used+1
  where id=v_unlock_id;

  insert into public.player_cards(owner_id,card_id,source,tramo_number,remaining_uses)
  values(v_user,v_card.id,'roulette',v_progress_tramo,v_card.uses_per_card)
  returning id into v_instance;

  select coalesce(sum(greatest(pu.spins_granted-pu.spins_used,0)),0)::integer
    into v_access_remaining
  from public.player_roulette_unlocks pu
  where pu.owner_id=v_user
    and pu.pool_id=v_pool.id
    and (pu.expires_at is null or pu.expires_at>pg_catalog.now());

  insert into public.card_activity(actor_id,card_instance_id,activity_type,details)
  values(
    v_user,v_instance,'roulette_spin',
    pg_catalog.jsonb_build_object(
      'tramo_number',v_progress_tramo,
      'card_slug',v_card.slug,
      'card_name',v_card.name,
      'rarity',v_card.rarity,
      'image_path',v_card.image_path,
      'roulette_pool',p_pool_slug,
      'roulette_name',v_pool.name,
      'roulette_weight',v_selected_weight,
      'access_spins_remaining',v_access_remaining
    )
  );

  return pg_catalog.jsonb_build_object(
    'player_card_id',v_instance,
    'card_id',v_card.id,
    'slug',v_card.slug,
    'name',v_card.name,
    'rarity',v_card.rarity,
    'category',v_card.category,
    'description',v_card.description,
    'image_path',v_card.image_path,
    'uses_per_card',v_card.uses_per_card,
    'remaining_uses',v_card.uses_per_card,
    'obtained_at',pg_catalog.now(),
    'tramo_number',v_progress_tramo,
    'normal_count',v_normal_count+case when v_card.category='normal' and v_card.counts_toward_normal_limit then 1 else 0 end,
    'normal_limit',v_limit,
    'roulette_pool',p_pool_slug,
    'roulette_name',v_pool.name,
    'roulette_weight',v_selected_weight,
    'access_spins_remaining',v_access_remaining
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.draw_special_roulette_card(p_pool_slug text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.draw_special_roulette_card_core(p_pool_slug);
$function$
;
REVOKE ALL ON FUNCTION app_private.draw_special_roulette_card_core(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.draw_special_roulette_card_core(text) TO authenticated;
REVOKE ALL ON FUNCTION public.draw_special_roulette_card(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_special_roulette_card(text) TO authenticated;

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='player_roulette_unlocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.player_roulette_unlocks;
  END IF;
END
$publication$;
