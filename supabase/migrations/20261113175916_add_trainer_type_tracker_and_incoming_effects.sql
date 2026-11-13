create table if not exists public.player_type_status (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type_slug text not null check (type_slug in (
    'normal','fuego','agua','electrico','planta','hielo',
    'lucha','veneno','tierra','volador','psiquico','bicho',
    'roca','fantasma','dragon','siniestro','acero','hada'
  )),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (owner_id, type_slug)
);

alter table public.player_type_status enable row level security;

create policy "Trainers can view their own type status"
  on public.player_type_status
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Trainers can add their own type status"
  on public.player_type_status
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Trainers can update their own type status"
  on public.player_type_status
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

grant select, insert, update on public.player_type_status to authenticated;
revoke all on public.player_type_status from anon;

create or replace function app_private.seed_player_pokemon_types()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.player_type_status (owner_id, type_slug, is_enabled)
  values
    (new.id, 'normal', true),
    (new.id, 'fuego', true),
    (new.id, 'agua', true),
    (new.id, 'electrico', true),
    (new.id, 'planta', true),
    (new.id, 'hielo', true),
    (new.id, 'lucha', true),
    (new.id, 'veneno', true),
    (new.id, 'tierra', true),
    (new.id, 'volador', true),
    (new.id, 'psiquico', true),
    (new.id, 'bicho', true),
    (new.id, 'roca', true),
    (new.id, 'fantasma', true),
    (new.id, 'dragon', true),
    (new.id, 'siniestro', true),
    (new.id, 'acero', true),
    (new.id, 'hada', true)
  on conflict (owner_id, type_slug) do nothing;

  return new;
end;
$function$;

revoke all on function app_private.seed_player_pokemon_types() from public, anon;
grant execute on function app_private.seed_player_pokemon_types() to authenticated;

drop trigger if exists seed_player_pokemon_types_after_profile_insert on public.profiles;
create trigger seed_player_pokemon_types_after_profile_insert
after insert on public.profiles
for each row
execute function app_private.seed_player_pokemon_types();

insert into public.player_type_status (owner_id, type_slug, is_enabled)
select p.id, t.type_slug, true
from public.profiles p
cross join (values
  ('normal'),('fuego'),('agua'),('electrico'),('planta'),('hielo'),
  ('lucha'),('veneno'),('tierra'),('volador'),('psiquico'),('bicho'),
  ('roca'),('fantasma'),('dragon'),('siniestro'),('acero'),('hada')
) as t(type_slug)
on conflict (owner_id, type_slug) do nothing;

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
  v_expired_effects integer := 0;
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

  v_tramo := v_progress.current_tramo + 1;

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
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_tramo);

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

  update public.player_effects pe
    set status = 'expired', remaining_uses = 0
  where pe.owner_id = v_user
    and pe.status = 'active'
    and (
      pe.duration_type = 'tramo_end'
      or (pe.expires_after_tramo is not null and pe.expires_after_tramo < v_tramo)
    );
  get diagnostics v_expired_effects = row_count;

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
      'cards', v_added,
      'effects_expired', v_expired_effects
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'tramo_number', v_tramo,
    'normal_spins_remaining', 3,
    'bonus_spins_remaining', 0,
    'effects_expired', v_expired_effects,
    'cards', v_added
  );
end;
$function$;

do $publication$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_type_status'
  ) then
    alter publication supabase_realtime add table public.player_type_status;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_effects'
  ) then
    alter publication supabase_realtime add table public.player_effects;
  end if;
end;
$publication$;
