do $patch$
declare
  v_definition text;
  v_old text := '  for v_effect in select value from jsonb_array_elements(p_effects)';
  v_new text := '  delete from public.card_effects where card_id = p_card_id;'||E'\n\n'||v_old;
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.admin_save_card_mechanics_core(uuid,text,text,jsonb,jsonb)'::regprocedure
  ) into v_definition;

  if pg_catalog.position(v_old in v_definition) = 0 then
    raise exception 'Could not locate the effect replacement section in admin_save_card_mechanics_core.';
  end if;

  execute pg_catalog.replace(v_definition, v_old, v_new);
end;
$patch$;
