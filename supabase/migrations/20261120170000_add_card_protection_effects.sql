-- TypeLink 2: card protection effects.
-- Protection is retroactive: when the player uses a protection card,
-- they select an incoming card from the current tramo and its active effects
-- on the player are cancelled.
-- protection_normal excludes Legendary and Fiesta cards.
-- protection_ultimate can protect against any incoming card.

do $patch$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure)
    into v_definition;

  v_old := '  v_unit text;'||E'\n'||
           '  v_spins integer;';
  v_new := '  v_unit text;'||E'\n'||
           '  v_spins integer;'||E'\n'||
           '  v_is_protection boolean := false;'||E'\n'||
           '  v_protection_activity_id uuid;'||E'\n'||
           '  v_protected_card record;'||E'\n'||
           '  v_protected_effects integer := 0;';
  if position(v_old in v_definition)=0 then raise exception 'play_card_core declaration anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := '  -- Resolve the destination from the card''s own targeting rule.';
  v_new := '  select exists ('||E'\n'||
           '    select 1 from public.card_effects ce'||E'\n'||
           '    where ce.card_id = v_card.card_id'||E'\n'||
           '      and ce.is_active = true'||E'\n'||
           '      and ce.effect_key in (''protection_normal'', ''protection_ultimate'')'||E'\n'||
           '  ) into v_is_protection;'||E'\n'||E'\n'||
           '  -- Protection cards use p_target_id as the selected incoming card activity id.'||E'\n'||
           '  -- The actual target remains the current player.'||E'\n'||
           '  -- Resolve the destination from the card''s own targeting rule.';
  if position(v_old in v_definition)=0 then raise exception 'play_card_core target anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := '    when ''self'' then'||E'\n'||
           '      if p_target_id is not null and p_target_id <> v_user then'||E'\n'||
           '        raise exception ''Esta carta solo puede aplicarse a ti mismo.'' using errcode = ''22023'';'||E'\n'||
           '      end if;'||E'\n'||
           '      v_target_id := v_user;';
  v_new := '    when ''self'' then'||E'\n'||
           '      if v_is_protection then'||E'\n'||
           '        v_protection_activity_id := p_target_id;'||E'\n'||
           '        v_target_id := v_user;'||E'\n'||
           '      else'||E'\n'||
           '        if p_target_id is not null and p_target_id <> v_user then'||E'\n'||
           '          raise exception ''Esta carta solo puede aplicarse a ti mismo.'' using errcode = ''22023'';'||E'\n'||
           '        end if;'||E'\n'||
           '        v_target_id := v_user;'||E'\n'||
           '      end if;';
  if position(v_old in v_definition)=0 then raise exception 'play_card_core self target anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := '  loop'||E'\n'||
           '    if v_effect.effect_key = ''unlock_roulette'' then';
  v_new := '  loop'||E'\n'||
           '    if v_effect.effect_key in (''protection_normal'', ''protection_ultimate'') then'||E'\n'||
           '      if v_effect.operation <> ''block'' or v_card.target_scope <> ''self'' or v_card.disposition <> ''consume'' then'||E'\n'||
           '        raise exception ''La carta de protección no tiene una configuración válida.'' using errcode = ''22023'';'||E'\n'||
           '      end if;'||E'\n'||
           '      if v_protection_activity_id is null then'||E'\n'||
           '        raise exception ''Selecciona una carta que te hayan lanzado para protegerte de ella.'' using errcode = ''22023'';'||E'\n'||
           '      end if;'||E'\n'||
           '      select ca.id, ca.actor_id, ca.card_instance_id, cc.name, cc.slug, cc.rarity, cc.category'||E'\n'||
           '        into v_protected_card'||E'\n'||
           '      from public.card_activity ca'||E'\n'||
           '      join public.player_cards pc on pc.id = ca.card_instance_id'||E'\n'||
           '      join public.card_catalog cc on cc.id = pc.card_id'||E'\n'||
           '      where ca.id = v_protection_activity_id'||E'\n'||
           '        and ca.activity_type = ''play'''||E'\n'||
           '        and ca.target_id = v_user'||E'\n'||
           '        and ca.actor_id is distinct from v_user;'||E'\n'||
           '      if not found then'||E'\n'||
           '        raise exception ''La carta seleccionada no es una carta que te hayan lanzado.'' using errcode = ''22023'';'||E'\n'||
           '      end if;'||E'\n'||
           '      if v_effect.effect_key = ''protection_normal'' and (v_protected_card.rarity = ''legendary'' or v_protected_card.category = ''fiesta'') then'||E'\n'||
           '        raise exception ''La Protección normal no puede proteger de cartas Legendarias ni Fiesta.'' using errcode = ''22023'';'||E'\n'||
           '      end if;'||E'\n'||
           '      update public.player_effects'||E'\n'||
           '      set status = ''cancelled'', remaining_uses = 0'||E'\n'||
           '      where owner_id = v_user'||E'\n'||
           '        and source_card_instance_id = v_protected_card.card_instance_id'||E'\n'||
           '        and status = ''active'';'||E'\n'||
           '      get diagnostics v_protected_effects = row_count;'||E'\n'||
           '      insert into public.card_activity(actor_id, target_id, card_instance_id, activity_type, details)'||E'\n'||
           '      values (v_user, v_user, v_card.instance_id, ''effect_applied'', pg_catalog.jsonb_build_object('||E'\n'||
           '        ''card_slug'', v_card.slug, ''card_name'', v_card.name, ''effect_key'', v_effect.effect_key,'||E'\n'||
           '        ''protected_activity_id'', v_protection_activity_id, ''protected_card_instance_id'', v_protected_card.card_instance_id,'||E'\n'||
           '        ''protected_card_name'', v_protected_card.name, ''protected_card_rarity'', v_protected_card.rarity,'||E'\n'||
           '        ''protected_card_category'', v_protected_card.category, ''cancelled_effects'', v_protected_effects,'||E'\n'||
           '        ''image_path'', v_card.image_path));'||E'\n'||
           '      v_applied_count := v_applied_count + 1;'||E'\n'||
           '      v_effects := v_effects || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('||E'\n'||
           '        ''effect_key'', v_effect.effect_key, ''operation'', v_effect.operation,'||E'\n'||
           '        ''protected_card_name'', v_protected_card.name, ''cancelled_effects'', v_protected_effects));'||E'\n'||
           '      continue;'||E'\n'||
           '    end if;'||E'\n'||
           '    if v_effect.effect_key = ''unlock_roulette'' then';
  if position(v_old in v_definition)=0 then raise exception 'play_card_core loop anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := '    ''roulette_unlocks'', v_unlocks';
  v_new := '    ''roulette_unlocks'', v_unlocks,'||E'\n'||
           '    ''protection'', v_is_protection,'||E'\n'||
           '    ''protected_card_name'', case when v_is_protection and v_protected_card.name is not null then v_protected_card.name else null end';
  if position(v_old in v_definition)=0 then raise exception 'play_card_core return anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  execute v_definition;
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

  v_old := '  v_saved_effects integer := 0;';
  v_new := '  v_saved_effects integer := 0;'||E'\n'||
           '  v_protection_effects integer := 0;';
  if position(v_old in v_definition)=0 then raise exception 'admin save declaration anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := '    elsif v_key = ''unlock_roulette'' then';
  v_new := '    elsif v_key in (''protection_normal'', ''protection_ultimate'') then'||E'\n'||
           '      v_protection_effects := v_protection_effects + 1;'||E'\n'||
           '      v_operation := ''block'';'||E'\n'||
           '      v_effect_value := null;'||E'\n'||
           '      v_duration := ''instant'';'||E'\n'||
           '      v_duration_value := null;'||E'\n'||
           '      v_unit := ''hours'';'||E'\n'||
           '      v_parameters := pg_catalog.jsonb_build_object(''protection_level'', case when v_key = ''protection_ultimate'' then ''ultimate'' else ''normal'' end);'||E'\n'||
           '      if p_target_scope <> ''self'' or p_disposition <> ''consume'' then'||E'\n'||
           '        raise exception ''Las cartas de protección requieren objetivo propio y consumo.'' using errcode = ''22023'';'||E'\n'||
           '      end if;'||E'\n'||
           '    elsif v_key = ''unlock_roulette'' then';
  if position(v_old in v_definition)=0 then raise exception 'admin protection branch anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := '  if v_unlock_effects > 1 or (v_unlock_effects > 0 and (v_limit_effects > 0 or v_spin_effects > 0)) then';
  v_new := '  if v_protection_effects > 1 or (v_protection_effects > 0 and (v_limit_effects > 0 or v_spin_effects > 0 or v_unlock_effects > 0)) then'||E'\n'||
           '    raise exception ''Una carta de protección no puede combinarse con otros efectos y solo puede tener una protección.'' using errcode = ''22023'';'||E'\n'||
           '  end if;'||E'\n'||E'\n'||v_old;
  if position(v_old in v_definition)=0 then raise exception 'admin compatibility anchor not found'; end if;
  v_definition := replace(v_definition,v_old,v_new);

  execute v_definition;
end;
$patch$;
