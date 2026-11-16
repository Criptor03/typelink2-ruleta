create or replace function app_private.get_trainer_incoming_card_count_core(p_trainer_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_tramo_started_at timestamptz;
  v_card_count integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para consultar las cartas recibidas de un entrenador.'
      using errcode = '28000';
  end if;

  if p_trainer_id is null then
    raise exception 'Debes indicar el entrenador que quieres consultar.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_trainer_id
  ) then
    raise exception 'El entrenador seleccionado no existe.'
      using errcode = 'P0002';
  end if;

  -- A new tramo award or an admin tramo adjustment starts a fresh received-card counter.
  -- The activity feed remains intact; only this per-tramo count is reset.
  select greatest(
    coalesce((
      select max(ca.created_at)
      from public.card_activity ca
      where ca.actor_id = p_trainer_id
        and ca.activity_type = 'tramo_award'
    ), '-infinity'::timestamptz),
    coalesce((
      select max(ca.created_at)
      from public.card_activity ca
      where ca.target_id = p_trainer_id
        and ca.activity_type = 'tramo_adjustment'
    ), '-infinity'::timestamptz),
    p.created_at
  )
  into v_tramo_started_at
  from public.profiles p
  where p.id = p_trainer_id;

  -- Count every card play directed at this trainer, including cards with no
  -- automatic website effect. Ignore self-targeted plays and transfers.
  select count(*)::integer
    into v_card_count
  from public.card_activity ca
  where ca.target_id = p_trainer_id
    and ca.actor_id is distinct from p_trainer_id
    and ca.activity_type = 'play'
    and ca.created_at > v_tramo_started_at;

  return coalesce(v_card_count, 0);
end;
$function$;

revoke all on function app_private.get_trainer_incoming_card_count_core(uuid)
  from public, anon, authenticated;

create or replace function public.get_trainer_incoming_card_count(p_trainer_id uuid)
returns integer
language sql
stable
set search_path to ''
as $function$
  select app_private.get_trainer_incoming_card_count_core(p_trainer_id);
$function$;

revoke all on function public.get_trainer_incoming_card_count(uuid)
  from public, anon;

grant execute on function app_private.get_trainer_incoming_card_count_core(uuid)
  to authenticated;

grant execute on function public.get_trainer_incoming_card_count(uuid)
  to authenticated;
