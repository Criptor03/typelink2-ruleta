alter table public.card_evolution_rules
  add column if not exists trigger_type text not null default 'manual';

alter table public.card_evolution_rules
  drop constraint if exists card_evolution_rules_trigger_type_check;
alter table public.card_evolution_rules
  add constraint card_evolution_rules_trigger_type_check
  check (trigger_type in ('manual','tramo_advance'));

create or replace function app_private.apply_tramo_evolutions_core(
  p_owner_id uuid,
  p_from_tramo integer,
  p_to_tramo integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source record;
  v_result public.card_catalog%rowtype;
  v_new_instance uuid;
  v_evolutions jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if auth.uid() is null or p_owner_id is distinct from auth.uid() then
    raise exception 'La evolución automática solo puede procesar el inventario de la sesión actual.' using errcode = '42501';
  end if;
  if p_to_tramo <= p_from_tramo then
    raise exception 'El tramo de destino debe ser superior al tramo actual.' using errcode = '22023';
  end if;

  for v_source in
    select
      pc.id as instance_id,
      pc.owner_id,
      pc.card_id,
      pc.source as inventory_source,
      pc.tramo_number,
      pc.remaining_uses,
      cc.slug as source_slug,
      cc.name as source_name,
      cc.image_path as source_image_path,
      cc.rarity as source_rarity,
      er.id as rule_id,
      er.slug as rule_slug,
      er.name as rule_name,
      er.same_tramo_only,
      er.result_card_id,
      rc.name as result_name,
      rc.slug as result_slug,
      rc.is_active as result_is_active
    from public.player_cards pc
    join public.card_catalog cc on cc.id = pc.card_id
    join public.card_evolution_rules er
      on er.source_card_id = pc.card_id
     and er.is_active = true
     and er.trigger_type = 'tramo_advance'
    join public.card_catalog rc on rc.id = er.result_card_id
    where pc.owner_id = p_owner_id
      and pc.status = 'available'
      and pc.remaining_uses > 0
    order by pc.obtained_at, pc.id
    for update of pc
  loop
    if v_source.same_tramo_only
       and (v_source.tramo_number is null or v_source.tramo_number <> p_from_tramo) then
      continue;
    end if;

    select * into v_result
    from public.card_catalog
    where id = v_source.result_card_id
      and is_active = true;

    if not found then
      raise exception 'La evolución de «%» no puede realizarse porque su carta resultado «%» está desactivada.',
        v_source.source_name, v_source.result_name using errcode = 'P0001';
    end if;

    update public.player_cards
    set status = 'used',
        remaining_uses = 0
    where id = v_source.instance_id;

    insert into public.player_cards(
      owner_id, card_id, source, tramo_number, status, remaining_uses
    )
    values(
      p_owner_id,
      v_result.id,
      'evolution',
      v_source.tramo_number,
      'available',
      v_result.uses_per_card
    )
    returning id into v_new_instance;

    insert into public.card_activity(
      actor_id, target_id, card_instance_id, activity_type, details
    )
    values(
      p_owner_id,
      p_owner_id,
      v_source.instance_id,
      'evolution',
      pg_catalog.jsonb_build_object(
        'rule_id', v_source.rule_id,
        'rule_slug', v_source.rule_slug,
        'evolution_trigger', 'tramo_advance',
        'from_tramo', p_from_tramo,
        'to_tramo', p_to_tramo,
        'source_instance_id', v_source.instance_id,
        'source_card_id', v_source.card_id,
        'source_slug', v_source.source_slug,
        'source_name', v_source.source_name,
        'source_image_path', v_source.source_image_path,
        'result_instance_id', v_new_instance,
        'result_card_id', v_result.id,
        'result_slug', v_result.slug,
        'result_name', v_result.name,
        'result_image_path', v_result.image_path,
        'result_uses', v_result.uses_per_card
      )
    );

    v_count := v_count + 1;
    v_evolutions := v_evolutions || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'source_instance_id', v_source.instance_id,
        'source_name', v_source.source_name,
        'source_image_path', v_source.source_image_path,
        'result_instance_id', v_new_instance,
        'result_card_id', v_result.id,
        'result_name', v_result.name,
        'result_image_path', v_result.image_path,
        'remaining_uses', v_result.uses_per_card,
        'from_tramo', p_from_tramo,
        'to_tramo', p_to_tramo
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'count', v_count,
    'items', v_evolutions
  );
end;
$function$;

revoke all on function app_private.apply_tramo_evolutions_core(uuid, integer, integer) from public, anon, authenticated;

create or replace function app_private.start_new_tramo_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_progress public.player_tramo_progress%rowtype;
  v_base_limit integer;
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
  v_auto_evolutions jsonb := pg_catalog.jsonb_build_object('count',0,'items','[]'::jsonb);
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

  -- Resolve automatic card evolutions first. The new cards remain in the same
  -- inventory slots unless the result card has a different slot configuration.
  v_auto_evolutions := app_private.apply_tramo_evolutions_core(
    v_user, v_previous_tramo, v_tramo
  );

  select es.normal_card_limit
    into v_base_limit
  from public.event_settings es
  where es.singleton = true;
  v_base_limit := coalesce(v_base_limit, 5);

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

  if v_limit - v_normal_count < 3 then
    raise exception 'Te quedan cartas por utilizar, así que no puedes avanzar de tramo hasta tener suficiente espacio. Libera al menos 3 espacios en tu baraja.' using errcode = 'P0001';
  end if;

  for v_card in
    select *
    from public.card_catalog cc
    where cc.category = 'tramo'
      and cc.is_active = true
    order by cc.slug
    limit 2
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

  if v_seen <> 2 then
    raise exception 'El catálogo debe tener dos cartas de tramo activas.' using errcode = 'P0002';
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
        spins_remaining = 3,
        bonus_spins_remaining = 0,
        updated_at = pg_catalog.now()
  where owner_id = v_user;

  insert into public.card_activity (actor_id, activity_type, details)
  values (
    v_user,
    'tramo_award',
    pg_catalog.jsonb_build_object(
      'tramo_number', v_tramo,
      'normal_spins_granted', 3,
      'cards', v_added,
      'automatic_evolutions', v_auto_evolutions,
      'effects_expired', v_expired_effects
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'tramo_number', v_tramo,
    'normal_spins_remaining', 3,
    'bonus_spins_remaining', 0,
    'effects_expired', v_expired_effects,
    'cards', v_added,
    'automatic_evolutions', v_auto_evolutions->'items',
    'automatic_evolutions_count', v_auto_evolutions->'count'
  );
end;
$function$;

create or replace function app_private.evolve_card_core(p_card_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_source record;
  v_rule record;
  v_result_card public.card_catalog%rowtype;
  v_new_instance uuid;
  v_current_tramo integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para evolucionar una carta.' using errcode = '28000';
  end if;
  if p_card_instance_id is null then
    raise exception 'Debes seleccionar la carta que quieres evolucionar.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select
    pc.id as instance_id,
    pc.owner_id,
    pc.card_id,
    pc.status,
    pc.remaining_uses,
    pc.tramo_number,
    cc.slug,
    cc.name,
    cc.rarity,
    cc.description,
    cc.image_path
  into v_source
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.id = p_card_instance_id
  for update of pc;

  if not found then
    raise exception 'No encontramos esa carta en tu inventario.' using errcode = 'P0002';
  end if;
  if v_source.owner_id <> v_user then
    raise exception 'Solo puedes evolucionar cartas de tu propio inventario.' using errcode = '42501';
  end if;
  if v_source.status <> 'available' or v_source.remaining_uses <= 0 then
    raise exception 'Esta carta ya no tiene usos disponibles.' using errcode = 'P0001';
  end if;

  select er.*
    into v_rule
  from public.card_evolution_rules er
  where er.source_card_id = v_source.card_id
    and er.is_active = true
    and er.trigger_type = 'manual'
  limit 1;

  if not found then
    raise exception 'Esta carta no tiene una evolución manual configurada. Las evoluciones automáticas ocurren al avanzar de tramo.' using errcode = 'P0002';
  end if;

  select coalesce(tp.current_tramo, 0)
    into v_current_tramo
  from public.player_tramo_progress tp
  where tp.owner_id = v_user;
  v_current_tramo := coalesce(v_current_tramo, 0);

  if v_rule.same_tramo_only and (
    v_source.tramo_number is null
    or v_source.tramo_number <> v_current_tramo
  ) then
    raise exception 'Esta evolución solo se puede realizar durante el tramo en que obtuviste la carta.' using errcode = 'P0001';
  end if;

  select *
    into v_result_card
  from public.card_catalog cc
  where cc.id = v_rule.result_card_id
    and cc.is_active = true;

  if not found then
    raise exception 'La carta resultante está desactivada o no existe.' using errcode = 'P0002';
  end if;

  update public.player_cards
  set status = 'used',
      remaining_uses = 0
  where id = v_source.instance_id;

  insert into public.player_cards(
    owner_id, card_id, source, tramo_number, status, remaining_uses
  )
  values (
    v_user, v_result_card.id, 'evolution', v_source.tramo_number,
    'available', v_result_card.uses_per_card
  )
  returning id into v_new_instance;

  insert into public.card_activity(
    actor_id, target_id, card_instance_id, activity_type, details
  )
  values (
    v_user, v_user, v_source.instance_id, 'evolution',
    pg_catalog.jsonb_build_object(
      'rule_id', v_rule.id,
      'rule_slug', v_rule.slug,
      'evolution_trigger', 'manual',
      'source_instance_id', v_source.instance_id,
      'source_card_id', v_source.card_id,
      'source_slug', v_source.slug,
      'source_name', v_source.name,
      'source_image_path', v_source.image_path,
      'result_instance_id', v_new_instance,
      'result_card_id', v_result_card.id,
      'result_slug', v_result_card.slug,
      'result_name', v_result_card.name,
      'result_image_path', v_result_card.image_path,
      'result_uses', v_result_card.uses_per_card
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'action', 'evolution',
    'source_instance_id', v_source.instance_id,
    'source_card_id', v_source.card_id,
    'source_slug', v_source.slug,
    'source_name', v_source.name,
    'source_image_path', v_source.image_path,
    'source_status', 'used',
    'result_instance_id', v_new_instance,
    'result_card_id', v_result_card.id,
    'result_slug', v_result_card.slug,
    'result_name', v_result_card.name,
    'result_rarity', v_result_card.rarity,
    'result_description', v_result_card.description,
    'result_image_path', v_result_card.image_path,
    'uses_per_card', v_result_card.uses_per_card,
    'remaining_uses', v_result_card.uses_per_card
  );
end;
$function$;

create or replace function app_private.admin_list_card_mechanics_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform app_private.require_admin();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'card', pg_catalog.to_jsonb(cc),
        'effects', coalesce((
          select jsonb_agg(pg_catalog.to_jsonb(ce) order by ce.sort_order, ce.created_at, ce.id)
          from public.card_effects ce
          where ce.card_id = cc.id
        ), '[]'::jsonb),
        'evolution', (
          select pg_catalog.to_jsonb(er)
          from public.card_evolution_rules er
          where er.source_card_id = cc.id
          limit 1
        )
      )
      order by cc.category, cc.rarity, cc.name
    ),
    '[]'::jsonb
  )
  into v_result
  from public.card_catalog cc;

  return v_result;
end;
$function$;

create or replace function app_private.admin_save_card_mechanics_core(
  p_card_id uuid,
  p_target_scope text,
  p_disposition text,
  p_effects jsonb,
  p_evolution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source public.card_catalog%rowtype;
  v_result public.card_catalog%rowtype;
  v_effect jsonb;
  v_key text;
  v_duration text;
  v_unit text;
  v_operation text;
  v_effect_value numeric;
  v_duration_value integer;
  v_parameters jsonb;
  v_active boolean;
  v_order integer := 0;
  v_limit_effects integer := 0;
  v_unlock_effects integer := 0;
  v_pool_slug text;
  v_spins integer;
  v_evolution_enabled boolean := false;
  v_result_card_id uuid;
  v_trigger text;
  v_same_tramo boolean;
  v_rule_name text;
  v_rule_description text;
  v_rule_slug text;
  v_saved_effects integer := 0;
begin
  perform app_private.require_admin();

  if p_card_id is null then
    raise exception 'Debes seleccionar una carta.' using errcode = '22023';
  end if;
  select * into v_source from public.card_catalog where id = p_card_id for update;
  if not found then
    raise exception 'La carta seleccionada ya no existe.' using errcode = 'P0002';
  end if;

  if p_target_scope not in ('self','opponent','either','all_players','event','none') then
    raise exception 'El objetivo de la carta no es válido.' using errcode = '22023';
  end if;
  if p_disposition not in ('consume','transfer') then
    raise exception 'El comportamiento de canje no es válido.' using errcode = '22023';
  end if;
  if p_effects is null or pg_catalog.jsonb_typeof(p_effects) <> 'array'
     or pg_catalog.jsonb_array_length(p_effects) > 10 then
    raise exception 'La lista de efectos no es válida. Puedes configurar hasta 10 efectos por carta.' using errcode = '22023';
  end if;

  for v_effect in select value from jsonb_array_elements(p_effects)
  loop
    v_key := coalesce(v_effect->>'effect_key','');
    v_duration := coalesce(v_effect->>'duration_type','');
    v_duration_value := nullif(v_effect->>'duration_value','')::integer;
    v_unit := coalesce(v_effect->>'duration_unit','hours');
    v_active := coalesce(nullif(v_effect->>'is_active','')::boolean,true);
    v_order := v_order + 1;

    if v_key = 'normal_card_limit' then
      v_limit_effects := v_limit_effects + 1;
      v_operation := 'add';
      v_effect_value := nullif(v_effect->>'effect_value','')::numeric;
      v_parameters := '{}'::jsonb;
      if v_effect_value is null or v_effect_value <> trunc(v_effect_value) or v_effect_value = 0 or abs(v_effect_value) > 10 then
        raise exception 'El modificador del límite debe ser un entero entre -10 y 10, distinto de cero.' using errcode = '22023';
      end if;
      if p_target_scope not in ('self','opponent','either') or p_disposition <> 'consume' then
        raise exception 'Aumentar o reducir espacios requiere objetivo propio, rival o cualquiera, y una carta consumible.' using errcode = '22023';
      end if;
      if v_duration not in ('tramo_end','next_tramo_end','timed','permanent') then
        raise exception 'El límite de baraja admite duración hasta fin de tramo, próximo tramo, temporal o permanente.' using errcode = '22023';
      end if;
      if v_duration = 'timed' and (v_duration_value is null or v_duration_value < 1 or v_unit not in ('seconds','minutes','hours','days')) then
        raise exception 'Indica una duración temporal válida.' using errcode = '22023';
      end if;
      if v_duration <> 'timed' then
        v_duration_value := null;
        v_unit := 'hours';
      end if;
    elsif v_key = 'unlock_roulette' then
      v_unlock_effects := v_unlock_effects + 1;
      v_operation := 'grant';
      v_effect_value := null;
      v_duration := 'instant';
      v_duration_value := null;
      v_unit := 'hours';
      v_pool_slug := coalesce(v_effect->'parameters'->>'pool_slug','');
      v_spins := coalesce(nullif(v_effect->'parameters'->>'spins_granted','')::integer,1);
      if v_pool_slug not in ('legendary','fiesta') or v_spins < 1 or v_spins > 100 then
        raise exception 'Elige la ruleta Legendaria o Fiesta y entre 1 y 100 giros.' using errcode = '22023';
      end if;
      if p_target_scope not in ('self','none') or p_disposition <> 'consume' then
        raise exception 'Desbloquear una ruleta requiere objetivo propio o ninguno, y una carta consumible.' using errcode = '22023';
      end if;
      v_parameters := pg_catalog.jsonb_build_object('pool_slug',v_pool_slug,'spins_granted',v_spins);
    else
      raise exception 'El efecto «%» todavía no tiene un controlador implementado. Selecciona un efecto compatible.', v_key using errcode = '0A000';
    end if;

    insert into public.card_effects(
      card_id,effect_key,operation,effect_value,parameters,duration_type,duration_value,duration_unit,sort_order,is_active
    )
    values(
      p_card_id,v_key,v_operation,v_effect_value,v_parameters,v_duration,v_duration_value,v_unit,v_order-1,v_active
    );
    v_saved_effects := v_saved_effects + 1;
  end loop;

  if v_limit_effects > 0 and v_unlock_effects > 0 then
    raise exception 'No combines modificar la baraja y desbloquear ruletas en la misma carta: sus objetivos son incompatibles.' using errcode = '22023';
  end if;
  if v_unlock_effects > 1 then
    raise exception 'Configura una sola ruleta por carta de acceso.' using errcode = '22023';
  end if;

  if v_limit_effects = 0 and v_unlock_effects = 0 then
    -- No effect rows remain, so the card can keep any compatible catalogue targeting settings.
    null;
  end if;

  update public.card_catalog
  set target_scope = p_target_scope,
      disposition = p_disposition
  where id = p_card_id
  returning * into v_source;

  v_evolution_enabled := coalesce(nullif(p_evolution->>'enabled','')::boolean,false);
  if v_evolution_enabled then
    v_result_card_id := nullif(p_evolution->>'result_card_id','')::uuid;
    v_trigger := coalesce(p_evolution->>'trigger_type','manual');
    v_same_tramo := coalesce(nullif(p_evolution->>'same_tramo_only','')::boolean,false);
    v_rule_name := coalesce(nullif(pg_catalog.btrim(p_evolution->>'name'),''),v_source.name||' → evolución');
    v_rule_description := coalesce(p_evolution->>'description','');
    v_rule_slug := pg_catalog.left('evo-'||v_source.slug,64);

    if v_result_card_id is null or v_result_card_id = p_card_id then
      raise exception 'Selecciona una carta resultado distinta de la carta original.' using errcode = '22023';
    end if;
    if v_trigger not in ('manual','tramo_advance') then
      raise exception 'El método de evolución no es válido.' using errcode = '22023';
    end if;
    if pg_catalog.length(v_rule_name) > 120 or pg_catalog.length(v_rule_description) > 500 then
      raise exception 'El nombre o descripción de evolución es demasiado largo.' using errcode = '22023';
    end if;

    select * into v_result from public.card_catalog where id = v_result_card_id and is_active = true;
    if not found then
      raise exception 'La carta resultado no existe o está desactivada.' using errcode = 'P0002';
    end if;

    insert into public.card_evolution_rules(
      slug,name,description,source_card_id,result_card_id,same_tramo_only,is_active,trigger_type
    )
    values(
      v_rule_slug,v_rule_name,v_rule_description,p_card_id,v_result_card_id,v_same_tramo,true,v_trigger
    )
    on conflict (source_card_id) do update
      set slug = excluded.slug,
          name = excluded.name,
          description = excluded.description,
          result_card_id = excluded.result_card_id,
          same_tramo_only = excluded.same_tramo_only,
          is_active = true,
          trigger_type = excluded.trigger_type;
  else
    update public.card_evolution_rules
    set is_active = false
    where source_card_id = p_card_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'success',true,
    'card_id',p_card_id,
    'card_name',v_source.name,
    'effects_saved',v_saved_effects,
    'evolution_enabled',v_evolution_enabled,
    'trigger_type',case when v_evolution_enabled then v_trigger else null end
  );
end;
$function$;

create or replace function public.admin_list_card_mechanics()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_list_card_mechanics_core();
$function$;

create or replace function public.admin_save_card_mechanics(
  p_card_id uuid,
  p_target_scope text,
  p_disposition text,
  p_effects jsonb,
  p_evolution jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_save_card_mechanics_core(
    p_card_id,p_target_scope,p_disposition,p_effects,p_evolution
  );
$function$;

revoke all on function app_private.admin_list_card_mechanics_core() from public,anon;
revoke all on function app_private.admin_save_card_mechanics_core(uuid,text,text,jsonb,jsonb) from public,anon;
grant execute on function app_private.admin_list_card_mechanics_core() to authenticated;
grant execute on function app_private.admin_save_card_mechanics_core(uuid,text,text,jsonb,jsonb) to authenticated;
revoke all on function public.admin_list_card_mechanics() from public,anon;
revoke all on function public.admin_save_card_mechanics(uuid,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.admin_list_card_mechanics() to authenticated;
grant execute on function public.admin_save_card_mechanics(uuid,text,text,jsonb,jsonb) to authenticated;
