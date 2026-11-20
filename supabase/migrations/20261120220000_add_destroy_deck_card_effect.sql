-- TypeLink 2: Romper baraja.
-- Removes all available cards from the selected opponent except Legendary and Fiesta cards.

do $patch$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure)
    into v_definition;

  if position('destroy_normal_deck' in v_definition) = 0 then
    v_old := '  v_unit text;'||E'\n'||'  v_spins integer;';
    v_new := '  v_unit text;'||E'\n'||
             '  v_spins integer;'||E'\n'||
             '  v_destroyed_cards integer := 0;'||E'\n'||
             '  v_destroyed_card_names jsonb := ''[]''::jsonb;';
    v_definition := replace(v_definition,v_old,v_new);

    v_old := '    if v_effect.effect_key in (''protection_normal'', ''protection_ultimate'') then';
    v_new := '    if v_effect.effect_key = ''destroy_normal_deck'' then'||E'\n'||
             '      if v_effect.operation <> ''block'' or v_card.target_scope <> ''opponent'' or v_card.disposition <> ''consume'' then raise exception ''La carta Romper baraja no tiene una configuración válida.'' using errcode = ''22023''; end if;'||E'\n'||
             '      if v_target_id is null or v_target_id = v_user then raise exception ''Debes elegir a otro entrenador para romper su baraja.'' using errcode = ''22023''; end if;'||E'\n'||
             '      select count(*) into v_destroyed_cards from public.player_cards pc join public.card_catalog cc on cc.id = pc.card_id where pc.owner_id = v_target_id and pc.status = ''available'' and cc.rarity <> ''legendary'' and cc.category <> ''fiesta'';'||E'\n'||
             '      select coalesce(pg_catalog.jsonb_agg(cc.name order by cc.name), ''[]''::jsonb) into v_destroyed_card_names from public.player_cards pc join public.card_catalog cc on cc.id = pc.card_id where pc.owner_id = v_target_id and pc.status = ''available'' and cc.rarity <> ''legendary'' and cc.category <> ''fiesta'';'||E'\n'||
             '      insert into public.card_activity(actor_id, target_id, card_instance_id, activity_type, details) values (v_user, v_target_id, v_card.instance_id, ''effect_applied'', pg_catalog.jsonb_build_object(''card_slug'', v_card.slug, ''card_name'', v_card.name, ''effect_key'', v_effect.effect_key, ''destroyed_cards'', v_destroyed_cards, ''destroyed_card_names'', v_destroyed_card_names, ''image_path'', v_card.image_path));'||E'\n'||
             '      delete from public.player_cards pc using public.card_catalog cc where pc.card_id = cc.id and pc.owner_id = v_target_id and pc.status = ''available'' and cc.rarity <> ''legendary'' and cc.category <> ''fiesta'';'||E'\n'||
             '      v_applied_count := v_applied_count + 1;'||E'\n'||
             '      v_effects := v_effects || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(''effect_key'', v_effect.effect_key, ''operation'', v_effect.operation, ''destroyed_cards'', v_destroyed_cards));'||E'\n'||
             '      continue;'||E'\n'||
             '    end if;'||E'\n'||
             '    if v_effect.effect_key in (''protection_normal'', ''protection_ultimate'') then';
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

  if position('destroy_normal_deck' in v_definition) = 0 then
    v_old := '    elsif v_key in (''protection_normal'', ''protection_ultimate'') then';
    v_new := '    elsif v_key = ''destroy_normal_deck'' then'||E'\n'||
             '      v_operation := ''block'';'||E'\n'||
             '      v_effect_value := null;'||E'\n'||
             '      v_duration := ''instant'';'||E'\n'||
             '      v_duration_value := null;'||E'\n'||
             '      v_unit := ''hours'';'||E'\n'||
             '      v_parameters := ''{}''::jsonb;'||E'\n'||
             '      if p_target_scope <> ''opponent'' or p_disposition <> ''consume'' then raise exception ''Romper baraja requiere objetivo rival y consumo.'' using errcode = ''22023''; end if;'||E'\n'||
             '    elsif v_key in (''protection_normal'', ''protection_ultimate'') then';
    v_definition := replace(v_definition,v_old,v_new);

    execute v_definition;
  end if;
end;
$patch$;