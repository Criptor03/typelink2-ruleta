-- Add the administrative action for permanently removing a participant.
-- The database migration is already applied to the active Supabase project.

create or replace function app_private.admin_delete_trainer_core(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_deleted_matches integer := 0;
  v_deleted_cards integer := 0;
begin
  perform app_private.require_admin();

  if p_player_id is null then
    raise exception 'Debes seleccionar un entrenador.' using errcode = '22023';
  end if;

  if p_player_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta de administrador.' using errcode = '42501';
  end if;

  if exists (
    select 1 from app_private.admin_users where user_id = p_player_id
  ) then
    raise exception 'No se puede eliminar una cuenta que tiene permisos de administrador.' using errcode = '42501';
  end if;

  select display_name into v_name
  from public.profiles
  where id = p_player_id;

  if v_name is null then
    raise exception 'El entrenador seleccionado no existe.' using errcode = 'P0002';
  end if;

  delete from public.typeleague_matches
  where participant_a_id = p_player_id or participant_b_id = p_player_id;
  get diagnostics v_deleted_matches = row_count;

  delete from public.notifications
  where recipient_id = p_player_id or actor_id = p_player_id;

  delete from public.event_effects
  where applied_by = p_player_id
     or source_card_instance_id in (
       select id from public.player_cards where owner_id = p_player_id
     );

  delete from public.player_effects
  where owner_id = p_player_id
     or applied_by = p_player_id
     or source_card_instance_id in (
       select id from public.player_cards where owner_id = p_player_id
     );

  delete from public.player_roulette_unlocks
  where owner_id = p_player_id
     or source_card_instance_id in (
       select id from public.player_cards where owner_id = p_player_id
     );

  delete from public.player_save_snapshots where player_id = p_player_id;
  delete from public.player_type_status where owner_id = p_player_id;
  delete from public.player_tramo_progress where owner_id = p_player_id;

  delete from public.card_activity
  where card_instance_id in (
    select id from public.player_cards where owner_id = p_player_id
  );

  delete from public.player_cards where owner_id = p_player_id;
  get diagnostics v_deleted_cards = row_count;

  -- Activity history remains; actor/target references are nullable.
  delete from public.profiles where id = p_player_id;
  delete from auth.users where id = p_player_id;

  return jsonb_build_object(
    'success', true,
    'player_id', p_player_id,
    'trainer_name', v_name,
    'deleted_cards', v_deleted_cards,
    'deleted_matches', v_deleted_matches
  );
end;
$function$;

create or replace function public.admin_delete_trainer(p_player_id uuid)
returns jsonb
language sql
set search_path = ''
as $function$
  select app_private.admin_delete_trainer_core(p_player_id);
$function$;

revoke all on function public.admin_delete_trainer(uuid) from public;
grant execute on function public.admin_delete_trainer(uuid) to authenticated;
