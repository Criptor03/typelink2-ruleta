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

  -- Saving the form replaces the previous configured effect rows atomically.
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
