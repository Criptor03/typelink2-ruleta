alter table public.card_activity
  drop constraint if exists card_activity_activity_type_check;

alter table public.card_activity
  add constraint card_activity_activity_type_check
  check (
    activity_type = any (array[
      'card_draw',
      'tramo_award',
      'play',
      'transfer',
      'consume',
      'evolution',
      'roulette_unlock',
      'roulette_spin',
      'effect_applied',
      'effect_expired',
      'admin_grant',
      'admin_remove',
      'tramo_adjustment'
    ]::text[])
  );

create or replace function app_private.admin_adjust_trainer_tramo_core(
  p_player_id uuid,
  p_new_tramo integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_old_tramo integer := 0;
  v_spins integer := 0;
  v_bonus_spins integer := 0;
begin
  perform app_private.require_admin();

  if p_player_id is null then
    raise exception 'Debes seleccionar un entrenador.' using errcode = '22023';
  end if;
  if p_new_tramo is null or p_new_tramo < 0 or p_new_tramo > 999 then
    raise exception 'El tramo debe estar entre 0 y 999.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_player_id::text, 0)
  );

  select * into v_profile
  from public.profiles
  where id = p_player_id
  for update;

  if not found then
    raise exception 'El entrenador seleccionado ya no existe.' using errcode = 'P0002';
  end if;

  select current_tramo, spins_remaining, bonus_spins_remaining
    into v_old_tramo, v_spins, v_bonus_spins
  from public.player_tramo_progress
  where owner_id = p_player_id
  for update;

  v_old_tramo := coalesce(v_old_tramo, 0);
  v_spins := coalesce(v_spins, 0);
  v_bonus_spins := coalesce(v_bonus_spins, 0);

  insert into public.player_tramo_progress(owner_id, current_tramo)
  values (p_player_id, p_new_tramo)
  on conflict (owner_id) do update
    set current_tramo = excluded.current_tramo,
        updated_at = pg_catalog.now();

  insert into public.card_activity(
    actor_id, target_id, activity_type, details
  )
  values (
    auth.uid(),
    p_player_id,
    'tramo_adjustment',
    pg_catalog.jsonb_build_object(
      'old_tramo', v_old_tramo,
      'new_tramo', p_new_tramo,
      'adjusted_by_admin', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'trainer_id', p_player_id,
    'trainer_name', v_profile.display_name,
    'old_tramo', v_old_tramo,
    'new_tramo', p_new_tramo,
    'spins_remaining', v_spins,
    'bonus_spins_remaining', v_bonus_spins,
    'inventory_preserved', true
  );
end;
$function$;

create or replace function app_private.admin_grant_trainer_card_core(
  p_player_id uuid,
  p_card_id uuid,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_card public.card_catalog%rowtype;
  v_first_instance uuid;
  v_instance_id uuid;
  v_added integer := 0;
  v_tramo integer := 0;
begin
  perform app_private.require_admin();

  if p_player_id is null or p_card_id is null then
    raise exception 'Debes seleccionar un entrenador y una carta.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Puedes entregar entre 1 y 20 copias por operación.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_player_id::text, 0)
  );

  select * into v_profile
  from public.profiles
  where id = p_player_id
  for update;

  if not found then
    raise exception 'El entrenador seleccionado ya no existe.' using errcode = 'P0002';
  end if;

  select * into v_card
  from public.card_catalog
  where id = p_card_id
  for share;

  if not found then
    raise exception 'La carta seleccionada ya no existe en el catálogo.' using errcode = 'P0002';
  end if;

  select current_tramo into v_tramo
  from public.player_tramo_progress
  where owner_id = p_player_id;
  v_tramo := coalesce(v_tramo, 0);

  for i in 1..p_quantity loop
    insert into public.player_cards(
      owner_id, card_id, source, tramo_number, status, remaining_uses
    )
    values (
      p_player_id, v_card.id, 'admin', null, 'available', v_card.uses_per_card
    )
    returning id into v_instance_id;

    if v_first_instance is null then
      v_first_instance := v_instance_id;
    end if;
    v_added := v_added + 1;
  end loop;

  insert into public.card_activity(
    actor_id, target_id, card_instance_id, activity_type, details
  )
  values (
    auth.uid(),
    p_player_id,
    v_first_instance,
    'admin_grant',
    pg_catalog.jsonb_build_object(
      'card_name', v_card.name,
      'image_path', v_card.image_path,
      'category', v_card.category,
      'rarity', v_card.rarity,
      'quantity', v_added,
      'source', 'admin',
      'at_tramo', v_tramo
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'trainer_id', p_player_id,
    'trainer_name', v_profile.display_name,
    'card_id', v_card.id,
    'card_name', v_card.name,
    'quantity_added', v_added,
    'uses_per_copy', v_card.uses_per_card,
    'at_tramo', v_tramo
  );
end;
$function$;

create or replace function app_private.admin_remove_trainer_card_core(
  p_player_id uuid,
  p_card_instance_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_instance public.player_cards%rowtype;
  v_card public.card_catalog%rowtype;
begin
  perform app_private.require_admin();

  if p_player_id is null or p_card_instance_id is null then
    raise exception 'Debes seleccionar un entrenador y una copia concreta.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_player_id::text, 0)
  );

  select * into v_profile
  from public.profiles
  where id = p_player_id
  for update;

  if not found then
    raise exception 'El entrenador seleccionado ya no existe.' using errcode = 'P0002';
  end if;

  select * into v_instance
  from public.player_cards
  where id = p_card_instance_id
    and owner_id = p_player_id
  for update;

  if not found then
    raise exception 'Esa copia ya no está en el inventario de este entrenador.' using errcode = 'P0002';
  end if;

  select * into v_card
  from public.card_catalog
  where id = v_instance.card_id;

  if not found then
    raise exception 'No se encontró la definición de la carta.' using errcode = 'P0002';
  end if;

  delete from public.player_cards
  where id = p_card_instance_id;

  insert into public.card_activity(
    actor_id, target_id, activity_type, details
  )
  values (
    auth.uid(),
    p_player_id,
    'admin_remove',
    pg_catalog.jsonb_build_object(
      'card_name', v_card.name,
      'image_path', v_card.image_path,
      'category', v_card.category,
      'rarity', v_card.rarity,
      'remaining_uses', v_instance.remaining_uses,
      'previous_status', v_instance.status,
      'source', v_instance.source,
      'removed_by_admin', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'trainer_id', p_player_id,
    'trainer_name', v_profile.display_name,
    'card_instance_id', p_card_instance_id,
    'card_name', v_card.name,
    'remaining_uses', v_instance.remaining_uses,
    'previous_status', v_instance.status
  );
end;
$function$;

create or replace function public.admin_adjust_trainer_tramo(
  p_player_id uuid,
  p_new_tramo integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_adjust_trainer_tramo_core(p_player_id, p_new_tramo);
$function$;

create or replace function public.admin_grant_trainer_card(
  p_player_id uuid,
  p_card_id uuid,
  p_quantity integer default 1
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_grant_trainer_card_core(p_player_id, p_card_id, p_quantity);
$function$;

create or replace function public.admin_remove_trainer_card(
  p_player_id uuid,
  p_card_instance_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_remove_trainer_card_core(p_player_id, p_card_instance_id);
$function$;

revoke all on function app_private.admin_adjust_trainer_tramo_core(uuid, integer) from public, anon;
revoke all on function app_private.admin_grant_trainer_card_core(uuid, uuid, integer) from public, anon;
revoke all on function app_private.admin_remove_trainer_card_core(uuid, uuid) from public, anon;
grant execute on function app_private.admin_adjust_trainer_tramo_core(uuid, integer) to authenticated;
grant execute on function app_private.admin_grant_trainer_card_core(uuid, uuid, integer) to authenticated;
grant execute on function app_private.admin_remove_trainer_card_core(uuid, uuid) to authenticated;

revoke all on function public.admin_adjust_trainer_tramo(uuid, integer) from public, anon;
revoke all on function public.admin_grant_trainer_card(uuid, uuid, integer) from public, anon;
revoke all on function public.admin_remove_trainer_card(uuid, uuid) from public, anon;
grant execute on function public.admin_adjust_trainer_tramo(uuid, integer) to authenticated;
grant execute on function public.admin_grant_trainer_card(uuid, uuid, integer) to authenticated;
grant execute on function public.admin_remove_trainer_card(uuid, uuid) to authenticated;
