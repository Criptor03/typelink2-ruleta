-- Transform card consumes the used card instance after changing it
-- into the selected catalog card.

do $patch$
declare v_definition text;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure) into v_definition;
  v_definition := replace(v_definition,
    'raise exception ''Transformar carta debe conservar la carta transformada.'' using errcode = ''22023'';',
    'raise exception ''Transformar carta requiere consumir la carta utilizada.'' using errcode = ''22023'';');
  v_definition := replace(v_definition,
    '        v_effects := v_effects || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('||E'\n'||
    '        ''effect_key'', v_effect.effect_key, ''operation'', v_effect.operation, ''result_name'', v_manipulation_result_name));'||E'\n'||
    '      continue;',
    '        v_effects := v_effects || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('||E'\n'||
    '        ''effect_key'', v_effect.effect_key, ''operation'', v_effect.operation, ''result_name'', v_manipulation_result_name));'||E'\n'||
    '      if v_effect.effect_key = ''transform_card'' then'||E'\n'||
    '        update public.player_cards set status = ''used'' where id = v_card.instance_id;'||E'\n'||
    '        insert into public.card_activity(actor_id, target_id, card_instance_id, activity_type, details)'||E'\n'||
    '        values (v_user, v_user, v_card.instance_id, ''consume'', pg_catalog.jsonb_build_object(''card_slug'', v_card.slug, ''card_name'', v_manipulation_result_name, ''image_path'', v_card.image_path));'||E'\n'||
    '      end if;'||E'\n'||
    '      continue;');
  execute v_definition;
end;
$patch$;