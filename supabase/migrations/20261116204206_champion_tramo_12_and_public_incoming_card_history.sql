-- TypeLink 2: Tramo 12 is the champion endpoint.
-- Keep the public activity history, but block any new opponent card play against champions.

create or replace function app_private.enforce_typelink_tramo_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.current_tramo > 12 then
    raise exception 'El Tramo 12 es el final de la aventura. No existen más tramos.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

revoke all on function app_private.enforce_typelink_tramo_limit()
  from public, anon, authenticated;

drop trigger if exists enforce_typelink_tramo_limit on public.player_tramo_progress;
create trigger enforce_typelink_tramo_limit
before insert or update of current_tramo on public.player_tramo_progress
for each row
execute function app_private.enforce_typelink_tramo_limit();


create or replace function app_private.block_card_plays_against_champion()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_target_tramo integer := 0;
begin
  if new.activity_type <> 'play'
     or new.target_id is null
     or new.actor_id is null
     or new.actor_id = new.target_id then
    return new;
  end if;

  select coalesce(pt.current_tramo, 0)
    into v_target_tramo
  from public.player_tramo_progress pt
  where pt.owner_id = new.target_id;

  if coalesce(v_target_tramo, 0) >= 12 then
    raise exception 'Este entrenador ya se ha consagrado Campeón Pokémon. No puedes lanzarle cartas.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

revoke all on function app_private.block_card_plays_against_champion()
  from public, anon, authenticated;

drop trigger if exists block_card_plays_against_champion on public.card_activity;
create trigger block_card_plays_against_champion
before insert on public.card_activity
for each row
execute function app_private.block_card_plays_against_champion();


create or replace function app_private.get_trainer_incoming_cards_core(p_trainer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_tramo_started_at timestamptz;
  v_cards jsonb := '[]'::jsonb;
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

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'activity_id', ca.id,
        'card_name', coalesce(nullif(ca.details ->> 'card_name',''), cc.name, 'Carta TypeLink'),
        'image_path', coalesce(nullif(ca.details ->> 'image_path',''), cc.image_path),
        'rarity', coalesce(nullif(ca.details ->> 'rarity',''), cc.rarity, 'card'),
        'card_slug', coalesce(ca.details ->> 'card_slug', cc.slug),
        'sender_id', ca.actor_id,
        'sender_name', coalesce(sender.display_name, 'Entrenador'),
        'custom_message', ca.details ->> 'custom_message',
        'created_at', ca.created_at
      )
      order by ca.created_at desc, ca.id desc
    ),
    '[]'::jsonb
  )
  into v_cards
  from public.card_activity ca
  left join public.profiles sender on sender.id = ca.actor_id
  left join public.player_cards pc on pc.id = ca.card_instance_id
  left join public.card_catalog cc on cc.id = pc.card_id
  where ca.target_id = p_trainer_id
    and ca.actor_id is distinct from p_trainer_id
    and ca.activity_type = 'play'
    and ca.created_at > v_tramo_started_at;

  return v_cards;
end;
$function$;

revoke all on function app_private.get_trainer_incoming_cards_core(uuid)
  from public, anon, authenticated;

create or replace function public.get_trainer_incoming_cards(p_trainer_id uuid)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select app_private.get_trainer_incoming_cards_core(p_trainer_id);
$function$;

revoke all on function public.get_trainer_incoming_cards(uuid)
  from public, anon;

grant execute on function app_private.get_trainer_incoming_cards_core(uuid)
  to authenticated;

grant execute on function public.get_trainer_incoming_cards(uuid)
  to authenticated;


create or replace function public.get_public_trainer_progress()
returns table(trainer_id uuid, current_tramo integer)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p.id,
    coalesce(pt.current_tramo, 0)::integer
  from public.profiles p
  left join public.player_tramo_progress pt on pt.owner_id = p.id
  where auth.uid() is not null
  order by p.created_at asc, p.id;
$function$;

revoke all on function public.get_public_trainer_progress()
  from public, anon;

grant execute on function public.get_public_trainer_progress()
  to authenticated;
