alter table public.card_catalog
  add column if not exists roulette_eligible boolean not null default true;

alter table public.card_catalog
  drop constraint if exists card_catalog_target_scope_check;
alter table public.card_catalog
  add constraint card_catalog_target_scope_check
  check (target_scope in ('self','opponent'));

update public.card_catalog cc
set roulette_eligible = false
where exists (
  select 1 from public.card_evolution_rules er
  where er.source_card_id = cc.id and er.is_active = true
);

delete from public.roulette_pool_cards rpc
where exists (
  select 1 from public.card_evolution_rules er
  where er.source_card_id = rpc.card_id and er.is_active = true
);

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
        roulette_eligible = v_roulette_eligible
    where id = v_id
    returning * into v_saved;
  else
    insert into public.card_catalog (
      slug, name, category, rarity, description, image_path, is_active,
      target_scope, disposition, counts_toward_normal_limit, uses_per_card, roulette_eligible
    )
    values (
      v_slug, v_name, v_category, v_rarity, v_description, v_image_path, v_is_active,
      v_target_scope, v_disposition, v_counts_toward_normal_limit, v_uses, v_roulette_eligible
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

CREATE OR REPLACE FUNCTION app_private.admin_list_catalog_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform app_private.require_admin();
  return (
    select coalesce(
      jsonb_agg(
        pg_catalog.to_jsonb(cc) || pg_catalog.jsonb_build_object(
          'has_active_evolution', exists (
            select 1 from public.card_evolution_rules er
            where er.source_card_id = cc.id and er.is_active = true
          ),
          'roulette_pools', coalesce((
            select pg_catalog.jsonb_agg(active_pools.slug order by active_pools.slug)
            from (
              select distinct rp.slug
              from public.roulette_pool_cards rpc
              join public.roulette_pools rp on rp.id = rpc.pool_id
              where rpc.card_id = cc.id
                and rpc.is_active = true
                and rp.is_active = true
            ) active_pools
          ), '[]'::jsonb)
        )
        order by cc.category, cc.rarity, cc.name
      ),
      '[]'::jsonb
    )
    from public.card_catalog cc
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION app_private.admin_save_card_mechanics_core(p_card_id uuid, p_target_scope text, p_disposition text, p_effects jsonb, p_evolution jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_spin_effects integer := 0;
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

  if p_target_scope not in ('self','opponent') then
    raise exception 'El objetivo debe ser quien utiliza la carta o un rival.' using errcode = '22023';
  end if;
  if p_disposition not in ('consume','transfer') then
    raise exception 'El comportamiento de canje no es válido.' using errcode = '22023';
  end if;
  if p_effects is null or pg_catalog.jsonb_typeof(p_effects) <> 'array'
     or pg_catalog.jsonb_array_length(p_effects) > 10 then
    raise exception 'La lista de efectos no es válida. Puedes configurar hasta 10 efectos por carta.' using errcode = '22023';
  end if;

  delete from public.card_effects where card_id = p_card_id;

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
      if p_target_scope not in ('self','opponent') or p_disposition <> 'consume' then
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
    elsif v_key = 'tramo_spin_credit' then
      v_spin_effects := v_spin_effects + 1;
      v_operation := 'add';
      v_effect_value := nullif(v_effect->>'effect_value','')::numeric;
      v_parameters := '{}'::jsonb;
      -- One charge lets play_card pass its duration validation; the insert trigger
      -- applies the credits immediately and expires the temporary effect row.
      v_duration := 'charges';
      v_duration_value := 1;
      v_unit := 'hours';
      if v_effect_value is null or v_effect_value <> trunc(v_effect_value) or v_effect_value < 1 or v_effect_value > 100 then
        raise exception 'Los giros extra deben ser un número entero entre 1 y 100.' using errcode = '22023';
      end if;
      if p_target_scope not in ('self','opponent') or p_disposition <> 'consume' then
        raise exception 'Conceder giros requiere un objetivo de jugador y una carta consumible.' using errcode = '22023';
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
      if p_target_scope <> 'self' or p_disposition <> 'consume' then
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

  if v_unlock_effects > 1 or (v_unlock_effects > 0 and (v_limit_effects > 0 or v_spin_effects > 0)) then
    raise exception 'Una carta de acceso a ruleta no puede combinarse con otros efectos porque necesita un objetivo distinto.' using errcode = '22023';
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

  if v_evolution_enabled then
    update public.card_catalog set roulette_eligible = false where id = p_card_id;
    delete from public.roulette_pool_cards where card_id = p_card_id;
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
$function$
;

CREATE OR REPLACE FUNCTION app_private.admin_list_roulette_pools_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  perform app_private.require_admin();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rp.id,
        'slug', rp.slug,
        'name', rp.name,
        'description', rp.description,
        'pool_type', rp.pool_type,
        'is_active', rp.is_active,
        'cards', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', cc.id,
              'slug', cc.slug,
              'name', cc.name,
              'category', cc.category,
              'rarity', cc.rarity,
              'description', cc.description,
              'image_path', cc.image_path,
              'uses_per_card', cc.uses_per_card,
              'catalog_active', cc.is_active,
              'weight', rpc.weight,
              'is_active', rpc.is_active
            )
            order by cc.name
          )
          from public.roulette_pool_cards rpc
          join public.card_catalog cc on cc.id = rpc.card_id
          where rpc.pool_id = rp.id
            and cc.roulette_eligible = true
            and not exists (
              select 1 from public.card_evolution_rules er
              where er.source_card_id = cc.id and er.is_active = true
            )
        ), '[]'::jsonb),
        'eligible_cards', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', cc.id,
              'slug', cc.slug,
              'name', cc.name,
              'category', cc.category,
              'rarity', cc.rarity,
              'description', cc.description,
              'image_path', cc.image_path,
              'uses_per_card', cc.uses_per_card,
              'is_active', cc.is_active
            )
            order by cc.name
          )
          from public.card_catalog cc
          where cc.roulette_eligible = true
            and not exists (
              select 1 from public.card_evolution_rules er
              where er.source_card_id = cc.id and er.is_active = true
            )
            and (
              (rp.slug = 'normal' and cc.category = 'normal' and cc.rarity <> 'legendary')
              or (rp.slug = 'legendary' and cc.category = 'normal' and cc.rarity = 'legendary')
              or (rp.slug = 'fiesta' and cc.category = 'fiesta')
            )
        ), '[]'::jsonb)
      )
      order by case rp.slug when 'normal' then 1 when 'legendary' then 2 when 'fiesta' then 3 else 4 end
    ),
    '[]'::jsonb
  )
  into v_result
  from public.roulette_pools rp
  where rp.slug in ('normal', 'legendary', 'fiesta');

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION app_private.admin_save_roulette_pool_core(p_pool_slug text, p_is_active boolean, p_description text, p_cards jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pool public.roulette_pools%rowtype;
  v_item jsonb;
  v_card public.card_catalog%rowtype;
  v_card_id uuid;
  v_weight integer;
  v_member_active boolean;
  v_total integer := 0;
  v_active integer := 0;
  v_added integer := 0;
begin
  perform app_private.require_admin();

  if p_pool_slug not in ('normal', 'legendary', 'fiesta') then
    raise exception 'La ruleta seleccionada no es válida.' using errcode = '22023';
  end if;
  if p_is_active is null then
    raise exception 'Debes indicar si la ruleta estará activa.' using errcode = '22023';
  end if;
  if p_description is null or pg_catalog.length(p_description) > 500 then
    raise exception 'La descripción no puede superar los 500 caracteres.' using errcode = '22023';
  end if;
  if p_cards is null or pg_catalog.jsonb_typeof(p_cards) <> 'array' then
    raise exception 'La lista de cartas de la ruleta no es válida.' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_cards) > 200 then
    raise exception 'Una ruleta no puede tener más de 200 cartas configuradas.' using errcode = '22023';
  end if;

  select * into v_pool
  from public.roulette_pools
  where slug = p_pool_slug
  for update;

  if not found then
    raise exception 'No encontramos esta ruleta en la configuración.' using errcode = 'P0002';
  end if;

  if (
    select count(*) <> count(distinct value->>'card_id')
    from jsonb_array_elements(p_cards)
  ) then
    raise exception 'No puedes incluir la misma carta dos veces en una ruleta.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_cards)
  loop
    begin
      v_card_id := (v_item->>'card_id')::uuid;
      v_weight := coalesce(nullif(v_item->>'weight', '')::integer, 1);
      v_member_active := coalesce(nullif(v_item->>'is_active', '')::boolean, true);
    exception when others then
      raise exception 'Una carta de la lista contiene datos no válidos.' using errcode = '22023';
    end;

    if v_weight < 1 or v_weight > 10000 then
      raise exception 'El peso de cada carta debe estar entre 1 y 10000.' using errcode = '22023';
    end if;

    select * into v_card
    from public.card_catalog
    where id = v_card_id
    for share;

    if not found then
      raise exception 'Una de las cartas seleccionadas ya no existe en el catálogo.' using errcode = 'P0002';
    end if;

    if not v_card.roulette_eligible or exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = v_card.id and er.is_active = true
    ) then
      raise exception 'La carta «%» está excluida de las ruletas o tiene una evolución activa.', v_card.name using errcode = '22023';
    end if;

    if p_pool_slug = 'normal'
       and not (v_card.category = 'normal' and v_card.rarity <> 'legendary') then
      raise exception 'La ruleta normal solo admite cartas normales comunes, raras o épicas.' using errcode = '22023';
    elsif p_pool_slug = 'legendary'
       and not (v_card.category = 'normal' and v_card.rarity = 'legendary') then
      raise exception 'La ruleta legendaria solo admite cartas normales de rareza legendaria.' using errcode = '22023';
    elsif p_pool_slug = 'fiesta'
       and v_card.category <> 'fiesta' then
      raise exception 'La ruleta Fiesta solo admite cartas de la categoría Fiesta.' using errcode = '22023';
    end if;

    if v_member_active and not v_card.is_active then
      raise exception 'La carta «%» está desactivada en el catálogo. Actívala allí antes de habilitarla en la ruleta.', v_card.name using errcode = '22023';
    end if;

    v_total := v_total + 1;
    if v_member_active then
      v_active := v_active + 1;
    end if;
  end loop;

  if p_is_active and v_active = 0 then
    raise exception 'No puedes activar esta ruleta sin al menos una carta habilitada.' using errcode = '22023';
  end if;

  delete from public.roulette_pool_cards
  where pool_id = v_pool.id;

  for v_item in select value from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item->>'card_id')::uuid;
    v_weight := coalesce(nullif(v_item->>'weight', '')::integer, 1);
    v_member_active := coalesce(nullif(v_item->>'is_active', '')::boolean, true);

    insert into public.roulette_pool_cards(pool_id, card_id, weight, is_active)
    values (v_pool.id, v_card_id, v_weight, v_member_active);

    v_added := v_added + 1;
  end loop;

  update public.roulette_pools
  set description = p_description,
      is_active = p_is_active
  where id = v_pool.id;

  return jsonb_build_object(
    'success', true,
    'pool_slug', p_pool_slug,
    'cards_saved', v_added,
    'active_cards', v_active,
    'pool_active', p_is_active,
    'configuration', app_private.admin_list_roulette_pools_core()
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_active_roulette_cards(p_pool_slug text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cc.id,
        'slug', cc.slug,
        'name', cc.name,
        'category', cc.category,
        'rarity', cc.rarity,
        'description', cc.description,
        'image_path', cc.image_path,
        'uses_per_card', cc.uses_per_card,
        'weight', rpc.weight
      )
      order by cc.name
    ),
    '[]'::jsonb
  )
  from public.roulette_pools rp
  join public.roulette_pool_cards rpc on rpc.pool_id = rp.id
  join public.card_catalog cc on cc.id = rpc.card_id
  where rp.slug = p_pool_slug
    and rp.is_active = true
    and rpc.is_active = true
    and cc.is_active = true
    and cc.roulette_eligible = true
    and not exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = cc.id and er.is_active = true
    )
    and (
      (p_pool_slug = 'normal' and cc.category = 'normal' and cc.rarity <> 'legendary')
      or (p_pool_slug = 'legendary' and cc.category = 'normal' and cc.rarity = 'legendary')
      or (p_pool_slug = 'fiesta' and cc.category = 'fiesta')
    );
$function$
;

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
    raise exception 'No tienes giros disponibles. Avanza de tramo para recibir tus 3 giros normales.' using errcode = 'P0001';
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
;
