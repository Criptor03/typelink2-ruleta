-- Fix card manipulation rules:
-- Copy incoming cards excludes Legendary/Fiesta.
-- Transform card consumes the used card after changing it to the selected card.

do $patch$
declare v_definition text;
begin
  select pg_catalog.pg_get_functiondef('app_private.admin_save_card_mechanics_core(uuid,text,text,jsonb,jsonb)'::regprocedure) into v_definition;
  v_definition := replace(v_definition,
    'if p_disposition not in (''consume'', ''transfer'') then',
    'if p_disposition not in (''consume'', ''transfer'', ''retain'') then');
  v_definition := replace(v_definition,
    'if v_key = ''transform_card'' then'||E'\n'||
    '        v_operation := ''set'';'||E'\n'||
    '        if p_disposition <> ''retain'' then raise exception ''Transformar carta debe conservar la carta transformada.'' using errcode = ''22023''; end if;'||E'\n'||
    '      else',
    'if v_key = ''transform_card'' then'||E'\n'||
    '        v_operation := ''set'';'||E'\n'||
    '        if p_disposition <> ''consume'' then raise exception ''Transformar carta requiere consumir la carta utilizada.'' using errcode = ''22023''; end if;'||E'\n'||
    '      else');
  execute v_definition;
end;
$patch$;

do $patch$
declare v_definition text;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure) into v_definition;
  v_definition := replace(v_definition,
    'if v_effect.effect_key = ''transform_card'' and v_card.disposition <> ''retain'' then',
    'if v_effect.effect_key = ''transform_card'' and v_card.disposition <> ''consume'' then');
  v_definition := replace(v_definition,
    '        if not exists (select 1 from public.profiles p where p.id = v_selected_activity.actor_id) then',
    '        if v_selected_activity.rarity = ''legendary'' or v_selected_activity.category = ''fiesta'' then'||E'\n'||
    '          raise exception ''No puedes copiar cartas Legendarias ni Fiesta.'' using errcode = ''22023'';'||E'\n'||
    '        end if;'||E'\n'||
    '        if not exists (select 1 from public.profiles p where p.id = v_selected_activity.actor_id) then');
  execute v_definition;
end;
$patch$;