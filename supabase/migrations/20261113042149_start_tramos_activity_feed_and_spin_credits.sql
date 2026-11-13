create table if not exists public.player_tramo_progress (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  current_tramo integer not null default 0 check (current_tramo >= 0),
  spins_remaining integer not null default 0 check (spins_remaining >= 0),
  bonus_spins_remaining integer not null default 0 check (bonus_spins_remaining >= 0),
  updated_at timestamptz not null default now()
);

alter table public.player_tramo_progress enable row level security;
create policy "Players can read their own tramo progress"
  on public.player_tramo_progress
  for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.player_tramo_progress from anon, authenticated;
grant select on public.player_tramo_progress to authenticated;

create index if not exists card_activity_created_at_idx
  on public.card_activity (created_at desc);

insert into public.player_tramo_progress (owner_id, current_tramo, spins_remaining, bonus_spins_remaining)
select pc.owner_id, coalesce(max(pc.tramo_number), 0), 0, 0
from public.player_cards pc
group by pc.owner_id
on conflict (owner_id) do nothing;

create or replace function app_private.apply_tramo_spin_credit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_spins integer;
begin
  if new.effect_key <> 'tramo_spin_credit' then
    return new;
  end if;

  if new.operation <> 'add'
     or new.effect_value is null
     or new.effect_value <> pg_catalog.trunc(new.effect_value) then
    raise exception 'El crédito de giros debe ser un número entero aditivo.' using errcode = '22023';
  end if;

  v_spins := new.effect_value::integer;
  if v_spins < 1 or v_spins > 100 then
    raise exception 'Los giros extra deben estar entre 1 y 100.' using errcode = '22023';
  end if;

  insert into public.player_tramo_progress (
    owner_id, current_tramo, spins_remaining, bonus_spins_remaining
  )
  values (new.owner_id, 0, 0, v_spins)
  on conflict (owner_id) do update
    set bonus_spins_remaining =
          public.player_tramo_progress.bonus_spins_remaining + excluded.bonus_spins_remaining,
        updated_at = pg_catalog.now();

  update public.player_effects
    set status = 'expired', remaining_uses = 0
  where id = new.id;

  return new;
end;
$function$;

drop trigger if exists apply_tramo_spin_credit_after_insert on public.player_effects;
create trigger apply_tramo_spin_credit_after_insert
after insert on public.player_effects
for each row
when (new.effect_key = 'tramo_spin_credit')
execute function app_private.apply_tramo_spin_credit();

create or replace function app_private.start_new_tramo_core()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_progress public.player_tramo_progress%rowtype;
  v_base_limit integer;
  v_limit integer;
  v_limit_bonus integer := 0;
  v_normal_count integer := 0;
  v_tramo integer;
  v_card public.card_catalog%rowtype;
  v_instance uuid;
  v_seen integer := 0;
  v_added jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para avanzar de tramo.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  insert into public.player_tramo_progress (owner_id, current_tramo)
  select v_user, coalesce(max(pc.tramo_number), 0)
  from public.player_cards pc
  where pc.owner_id = v_user
  on conflict (owner_id) do nothing;

  select *
    into v_progress
  from public.player_tramo_progress
  where owner_id = v_user
  for update;

  if coalesce(v_progress.spins_remaining, 0) + coalesce(v_progress.bonus_spins_remaining, 0) > 0 then
    raise exception 'Aún tienes giros pendientes de este tramo. Utilízalos antes de avanzar.' using errcode = 'P0001';
  end if;

  select es.normal_card_limit
    into v_base_limit
  from public.event_settings es
  where es.singleton = true;
  v_base_limit := coalesce(v_base_limit, 5);

  select coalesce(sum(pe.effect_value), 0)::integer
    into v_limit_bonus
  from public.player_effects pe
  where pe.owner_id = v_user
    and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add'
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_progress.current_tramo);

  v_limit := greatest(v_base_limit + v_limit_bonus, 0);

  select count(*)::integer
    into v_normal_count
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = v_user
    and pc.status = 'available'
    and cc.category = 'normal'
    and cc.counts_toward_normal_limit = true;

  if v_limit - v_normal_count < 3 then
    raise exception 'Te quedan cartas por utilizar, así que no puedes avanzar de tramo hasta tener suficiente espacio. Libera al menos 3 espacios en tu baraja.' using errcode = 'P0001';
  end if;

  v_tramo := v_progress.current_tramo + 1;

  for v_card in
    select *
    from public.card_catalog cc
    where cc.category = 'tramo'
      and cc.is_active = true
    order by cc.slug
    limit 2
  loop
    insert into public.player_cards (
      owner_id, card_id, source, tramo_number, remaining_uses
    )
    values (
      v_user, v_card.id, 'tramo', v_tramo, v_card.uses_per_card
    )
    returning id into v_instance;

    v_seen := v_seen + 1;
    v_added := v_added || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'player_card_id', v_instance,
        'card_id', v_card.id,
        'slug', v_card.slug,
        'name', v_card.name,
        'rarity', v_card.rarity,
        'category', v_card.category,
        'description', v_card.description,
        'image_path', v_card.image_path,
        'uses_per_card', v_card.uses_per_card,
        'remaining_uses', v_card.uses_per_card,
        'tramo_number', v_tramo
      )
    );
  end loop;

  if v_seen <> 2 then
    raise exception 'El catálogo debe tener dos cartas de tramo activas.' using errcode = 'P0002';
  end if;

  update public.player_tramo_progress
    set current_tramo = v_tramo,
        spins_remaining = 3,
        bonus_spins_remaining = 0,
        updated_at = pg_catalog.now()
  where owner_id = v_user;

  insert into public.card_activity (actor_id, activity_type, details)
  values (
    v_user,
    'tramo_award',
    pg_catalog.jsonb_build_object(
      'tramo_number', v_tramo,
      'normal_spins_granted', 3,
      'cards', v_added
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'tramo_number', v_tramo,
    'normal_spins_remaining', 3,
    'bonus_spins_remaining', 0,
    'cards', v_added
  );
end;
$function$;

create or replace function app_private.draw_normal_card_with_tramo_credit_core()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_progress public.player_tramo_progress%rowtype;
  v_base_limit integer;
  v_limit integer;
  v_limit_bonus integer := 0;
  v_normal_count integer := 0;
  v_card public.card_catalog%rowtype;
  v_instance uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para girar la ruleta.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select *
    into v_progress
  from public.player_tramo_progress
  where owner_id = v_user
  for update;

  if not found
     or coalesce(v_progress.spins_remaining, 0) + coalesce(v_progress.bonus_spins_remaining, 0) < 1 then
    raise exception 'No tienes giros disponibles. Avanza de tramo para recibir tus 3 giros normales.' using errcode = 'P0001';
  end if;

  select es.normal_card_limit
    into v_base_limit
  from public.event_settings es
  where es.singleton = true;
  v_base_limit := coalesce(v_base_limit, 5);

  select coalesce(sum(pe.effect_value), 0)::integer
    into v_limit_bonus
  from public.player_effects pe
  where pe.owner_id = v_user
    and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add'
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_progress.current_tramo);

  v_limit := greatest(v_base_limit + v_limit_bonus, 0);

  select count(*)::integer
    into v_normal_count
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = v_user
    and pc.status = 'available'
    and cc.category = 'normal'
    and cc.counts_toward_normal_limit = true;

  if v_normal_count >= v_limit then
    raise exception 'Tu baraja está completa. Tu límite efectivo es de % cartas normales.', v_limit using errcode = 'P0001';
  end if;

  select *
    into v_card
  from public.card_catalog cc
  where cc.category = 'normal'
    and cc.is_active = true
  order by pg_catalog.random()
  limit 1;

  if not found then
    raise exception 'No hay cartas normales activas en el catálogo.' using errcode = 'P0002';
  end if;

  insert into public.player_cards (owner_id, card_id, source, remaining_uses)
  values (v_user, v_card.id, 'roulette', v_card.uses_per_card)
  returning id into v_instance;

  if v_progress.spins_remaining > 0 then
    update public.player_tramo_progress
      set spins_remaining = spins_remaining - 1,
          updated_at = pg_catalog.now()
    where owner_id = v_user;
    v_progress.spins_remaining := v_progress.spins_remaining - 1;
  else
    update public.player_tramo_progress
      set bonus_spins_remaining = bonus_spins_remaining - 1,
          updated_at = pg_catalog.now()
    where owner_id = v_user;
    v_progress.bonus_spins_remaining := v_progress.bonus_spins_remaining - 1;
  end if;

  insert into public.card_activity (
    actor_id, card_instance_id, activity_type, details
  )
  values (
    v_user, v_instance, 'roulette_spin',
    pg_catalog.jsonb_build_object(
      'tramo_number', v_progress.current_tramo,
      'card_slug', v_card.slug,
      'card_name', v_card.name,
      'rarity', v_card.rarity,
      'image_path', v_card.image_path,
      'normal_spins_remaining', v_progress.spins_remaining,
      'bonus_spins_remaining', v_progress.bonus_spins_remaining
    )
  );

  return pg_catalog.jsonb_build_object(
    'player_card_id', v_instance,
    'card_id', v_card.id,
    'slug', v_card.slug,
    'name', v_card.name,
    'rarity', v_card.rarity,
    'category', v_card.category,
    'description', v_card.description,
    'image_path', v_card.image_path,
    'uses_per_card', v_card.uses_per_card,
    'remaining_uses', v_card.uses_per_card,
    'obtained_at', pg_catalog.now(),
    'normal_count', v_normal_count + 1,
    'normal_limit_base', v_base_limit,
    'normal_limit_bonus', v_limit_bonus,
    'normal_limit', v_limit,
    'tramo_number', v_progress.current_tramo,
    'normal_spins_remaining', v_progress.spins_remaining,
    'bonus_spins_remaining', v_progress.bonus_spins_remaining
  );
end;
$function$;

create or replace function public.start_new_tramo()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select app_private.start_new_tramo_core();
$function$;

create or replace function public.issue_tramo_cards()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select app_private.start_new_tramo_core();
$function$;

create or replace function public.draw_random_card()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select app_private.draw_normal_card_with_tramo_credit_core();
$function$;

revoke all on function app_private.apply_tramo_spin_credit() from public, anon, authenticated;
revoke all on function app_private.start_new_tramo_core() from public, anon;
revoke all on function app_private.draw_normal_card_with_tramo_credit_core() from public, anon;
revoke all on function public.start_new_tramo() from public, anon;
revoke all on function public.issue_tramo_cards() from public, anon;
revoke all on function public.draw_random_card() from public, anon;

grant execute on function public.start_new_tramo() to authenticated;
grant execute on function public.issue_tramo_cards() to authenticated;
grant execute on function public.draw_random_card() to authenticated;

do $publication$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'card_activity'
  ) then
    alter publication supabase_realtime add table public.card_activity;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_tramo_progress'
  ) then
    alter publication supabase_realtime add table public.player_tramo_progress;
  end if;
end;
$publication$;
