create or replace function app_private.admin_clear_trainer_sync_core(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_name text;
  v_deleted integer := 0;
begin
  perform app_private.require_admin();

  if p_player_id is null then
    raise exception 'Debes seleccionar un entrenador.' using errcode = '22023';
  end if;

  select display_name into v_name
  from public.profiles
  where id = p_player_id;

  if v_name is null then
    raise exception 'El entrenador seleccionado no existe.' using errcode = 'P0002';
  end if;

  delete from public.player_save_snapshots
  where player_id = p_player_id;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'success', true,
    'player_id', p_player_id,
    'trainer_name', v_name,
    'deleted_snapshots', v_deleted
  );
end;
$function$;

create or replace function public.admin_clear_trainer_sync(p_player_id uuid)
returns jsonb
language sql
set search_path to ''
as $function$
  select app_private.admin_clear_trainer_sync_core(p_player_id);
$function$;

grant execute on function public.admin_clear_trainer_sync(uuid) to authenticated;
