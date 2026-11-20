-- TypeLink 2: card copy, incoming-card copy, steal and transform effects.
-- Selection is passed through p_target_id:
--   copy/steal opponent -> player_card instance id
--   copy incoming -> card_activity id
--   transform -> card_catalog id

create or replace function public.get_opponent_card_choices()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para consultar cartas de rivales.' using errcode = '28000';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'card_instance_id', pc.id,
        'card_id', pc.card_id,
        'card_name', cc.name,
        'card_slug', cc.slug,
        'rarity', cc.rarity,
        'category', cc.category,
        'image_path', cc.image_path,
        'owner_id', pc.owner_id,
        'owner_name', coalesce(p.display_name, 'Entrenador'),
        'remaining_uses', pc.remaining_uses
      )
      order by p.display_name, cc.name, pc.obtained_at
    ),
    '[]'::jsonb
  )
  into v_result
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  join public.profiles p on p.id = pc.owner_id
  where pc.owner_id is distinct from v_user
    and pc.status = 'available'
    and pc.remaining_uses > 0
    and cc.is_active = true
    and cc.rarity <> 'legendary'
    and cc.category <> 'fiesta';

  return v_result;
end;
$function$;

revoke all on function public.get_opponent_card_choices() from public, anon;
grant execute on function public.get_opponent_card_choices() to authenticated;

do $patch$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure)
    into v_definition;

  if position('copy_opponent_card' in v_definition) = 0 then
    v_old := '  v_protected_effects integer := 0;';
    v_new := v_old||E'\n'||
             '  v_selected_card record;'||E'\n'||
             '  v_selected_activity record;'||E'\n'||
             '  v_manipulation_action text;'||E'\n'||
             '  v_manipulation_result_name text;'||E'\n'||
             '  v_manipulation_result_card_id uuid;';
    v_definition := replace(v_definition,v_old,v_new);

    v_old := '    if v_effect.effect_key = ''destroy_normal_deck'' then';
    v_new := '    if v_effect.effect_key in (''copy_opponent_card'', ''copy_incoming_card'', ''steal_opponent_card'', ''transform_card'') then'||E'\n'||
             '      if v_card.disposition not in (''consume'', ''retain'') or v_card.target_scope <> ''self'' then raise exception ''La carta de manipulación no tiene una configuración válida.'' using errcode = ''22023''; end if;'||E'\n'||
             '      if v_effect.effect_key = ''transform_card'' and v_card.disposition <> ''retain'' then raise exception ''Transformar carta debe conservar la carta transformada.'' using errcode = ''22023''; end if;'||E'\n'||
             '      if v_effect.effect_key <> ''transform_card'' and v_card.disposition <> ''consume'' then raise exception ''Copiar o robar una carta requiere consumir la carta utilizada.'' using errcode = ''22023''; end if;'||E'\n'||
             '      v_manipulation_action := case when v_effect.effect_key in (''copy_opponent_card'', ''copy_incoming_card'') then ''copy'' when v_effect.effect_key = ''steal_opponent_card'' then ''steal'' else ''transform'' end;'||E'\n'||
             '      if p_target_id is null then raise exception ''Selecciona una carta para aplicar este efecto.'' using errcode = ''22023''; end if;'||E'\n'||
             '      if v_effect.effect_key in (''copy_opponent_card'', ''steal_opponent_card'') then'||E'\n'||
             '        select pc.id, pc.owner_id, pc.card_id, pc.remaining_uses, pc.status, cc.name, cc.slug, cc.rarity, cc.category, cc.image_path, cc.uses_per_card into v_selected_card'||E'\n'||
             '        from public.player_cards pc join public.card_catalog cc on cc.id = pc.card_id'||E'\n'||
             '        where pc.id = p_target_id and pc.owner_id is distinct from v_user and pc.status = ''available'' and pc.remaining_uses > 0 and cc.is_active = true and cc.rarity <> ''legendary'' and cc.category <> ''fiesta'' for update of pc;'||E'\n'||
             '        if not found then raise exception ''La carta seleccionada ya no está disponible o no se puede copiar/robar.'' using errcode = ''22023''; end if;'||E'\n'||
             '        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_selected_card.owner_id::text, 0));'||E'\n'||
             '      elsif v_effect.effect_key = ''copy_incoming_card'' then'||E'\n'||
             '        select ca.id, ca.actor_id, ca.card_instance_id, cc.id as card_id, cc.name, cc.slug, cc.rarity, cc.category, cc.image_path, cc.uses_per_card into v_selected_activity'||E'\n'||
             '        from public.card_activity ca join public.player_cards pc on pc.id = ca.card_instance_id join public.card_catalog cc on cc.id = pc.card_id'||E'\n'||
             '        where ca.id = p_target_id and ca.target_id = v_user and ca.actor_id is distinct from v_user and ca.activity_type = ''play'';'||E'\n'||
             '        if not found then raise exception ''La carta seleccionada no es una carta que te hayan lanzado.'' using errcode = ''22023''; end if;'||E'\n'||
             '      else'||E'\n'||
             '        select id, name, slug, rarity, category, image_path, uses_per_card into v_selected_card from public.card_catalog where id = p_target_id and is_active = true and id <> v_card.card_id;'||E'\n'||
             '        if not found then raise exception ''La carta de transformación seleccionada no existe o es la misma carta.'' using errcode = ''22023''; end if;'||E'\n'||
             '      end if;'||E'\n'||
             '      if v_effect.effect_key in (''copy_opponent_card'', ''copy_incoming_card'') then'||E'\n'||
             '        if v_effect.effect_key = ''copy_opponent_card'' then'||E'\n'||
             '          insert into public.player_cards(owner_id, card_id, source, remaining_uses) values (v_user, v_selected_card.card_id, ''card_copy'', v_selected_card.uses_per_card);'||E'\n'||
             '          v_manipulation_result_name := v_selected_card.name; v_manipulation_result_card_id := v_selected_card.card_id;'||E'\n'||
             '        else'||E'\n'||
             '          insert into public.player_cards(owner_id, card_id, source, remaining_uses) values (v_user, v_selected_activity.card_id, ''card_copy'', v_selected_activity.uses_per_card);'||E'\n'||
             '          v_manipulation_result_name := v_selected_activity.name; v_manipulation_result_card_id := v_selected_activity.card_id;'||E'\n'||
             '        end if;'||E'\n'||
             '      elsif v_effect.effect_key = ''steal_opponent_card'' then'||E'\n'||
             '        update public.player_cards set owner_id = v_user where id = v_selected_card.id;'||E'\n'||
             '        v_manipulation_result_name := v_selected_card.name; v_manipulation_result_card_id := v_selected_card.card_id;'||E'\n'||
             '      else'||E'\n'||
             '        update public.player_cards set card_id = v_selected_card.id, remaining_uses = v_selected_card.uses_per_card where id = v_card.instance_id;'||E'\n'||
             '        v_manipulation_result_name := v_selected_card.name; v_manipulation_result_card_id := v_selected_card.id;'||E'\n'||
             '      end if;'||E'\n'||
             '      insert into public.card_activity(actor_id, target_id, card_instance_id, activity_type, details) values (v_user, v_user, v_card.instance_id, ''effect_applied'', pg_catalog.jsonb_build_object(''card_slug'', v_card.slug, ''card_name'', v_card.name, ''effect_key'', v_effect.effect_key, ''manipulation_action'', v_manipulation_action, ''result_name'', v_manipulation_result_name, ''result_card_id'', v_manipulation_result_card_id, ''image_path'', v_card.image_path));'||E'\n'||
             '      v_applied_count := v_applied_count + 1;'||E'\n'||
             '      v_effects := v_effects || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(''effect_key'', v_effect.effect_key, ''operation'', v_effect.operation, ''result_name'', v_manipulation_result_name));'||E'\n'||
             '      continue;'||E'\n'||
             '    end if;'||E'\n'||
             '    if v_effect.effect_key = ''destroy_normal_deck'' then';
    v_definition := replace(v_definition,v_old,v_new);

    v_old := '    ''protected_card_name'', case when v_is_protection and v_protected_card.name is not null then v_protected_card.name else null end';
    v_new := v_old||E'\n'||
             '    , ''manipulation_action'', v_manipulation_action'||E'\n'||
             '    , ''result_name'', v_manipulation_result_name';
    v_definition := replace(v_definition,v_old,v_new);

    execute v_definition;
  end if;
end;
$patch$;

do $patch$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_catalog.pg_get_functiondef('app_private.admin_save_card_mechanics_core(uuid,text,text,jsonb,jsonb)'::regprocedure)
    into v_definition;

  if position('copy_opponent_card' in v_definition) = 0 then
    v_old := '  v_protection_effects integer := 0;';
    v_new := v_old||E'\n'||'  v_manipulation_effects integer := 0;';
    v_definition := replace(v_definition,v_old,v_new);

    v_old := '    elsif v_key in (''protection_normal'', ''protection_ultimate'') then';
    v_new := '    elsif v_key in (''copy_opponent_card'', ''copy_incoming_card'', ''steal_opponent_card'', ''transform_card'') then'||E'\n'||
             '      v_manipulation_effects := v_manipulation_effects + 1;'||E'\n'||
             '      v_effect_value := null; v_duration := ''instant''; v_duration_value := null; v_unit := ''hours''; v_parameters := ''{}''::jsonb;'||E'\n'||
             '      if p_target_scope <> ''self'' then raise exception ''Estos efectos afectan al propio usuario.'' using errcode = ''22023''; end if;'||E'\n'||
             '      if v_key = ''transform_card'' then v_operation := ''set''; if p_disposition <> ''retain'' then raise exception ''Transformar carta debe conservar la carta transformada.'' using errcode = ''22023''; end if;'||E'\n'||
             '      else v_operation := ''grant''; if p_disposition <> ''consume'' then raise exception ''Copiar o robar una carta requiere consumir la carta utilizada.'' using errcode = ''22023''; end if; end if;'||E'\n'||
             '    elsif v_key in (''protection_normal'', ''protection_ultimate'') then';
    v_definition := replace(v_definition,v_old,v_new);

    v_old := '  if v_protection_effects > 1 or (v_protection_effects > 0 and (v_limit_effects > 0 or v_spin_effects > 0 or v_unlock_effects > 0)) then';
    v_new := v_old||E'\n'||
             '  if v_manipulation_effects > 1 or (v_manipulation_effects > 0 and (v_limit_effects > 0 or v_spin_effects > 0 or v_unlock_effects > 0 or v_protection_effects > 0)) then'||E'\n'||
             '    raise exception ''Una carta de manipulación solo puede tener uno de estos efectos y no puede combinarse con otros efectos.'' using errcode = ''22023'';'||E'\n'||
             '  end if;';
    v_definition := replace(v_definition,v_old,v_new);

    execute v_definition;
  end if;
end;
$patch$;

do $patch$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('app_private.admin_save_card_core(jsonb)'::regprocedure)
    into v_definition;
  if position('retain' in v_definition) = 0 then
    v_definition := replace(v_definition,'if v_disposition not in (''consume'', ''transfer'') then','if v_disposition not in (''consume'', ''transfer'', ''retain'') then');
    execute v_definition;
  end if;
end;
$patch$;