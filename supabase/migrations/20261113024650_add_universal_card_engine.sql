-- TypeLink 2 universal card engine.
-- Additive only: existing profiles, card catalog rows and player inventory are preserved.

alter table public.card_catalog
  drop constraint if exists card_catalog_category_check,
  drop constraint if exists card_catalog_category_rarity_check,
  drop constraint if exists card_catalog_rarity_check;

alter table public.card_catalog
  add constraint card_catalog_category_check
    check (category in ('normal', 'tramo', 'fiesta')),
  add constraint card_catalog_rarity_check
    check (rarity in ('common', 'rare', 'epic', 'legendary', 'tramo', 'fiesta')),
  add constraint card_catalog_category_rarity_check
    check (
      (category = 'normal' and rarity in ('common', 'rare', 'epic', 'legendary'))
      or (category = 'tramo' and rarity = 'tramo')
      or (category = 'fiesta' and rarity = 'fiesta')
    );

alter table public.card_catalog
  add column if not exists target_scope text not null default 'self',
  add column if not exists disposition text not null default 'consume',
  add column if not exists counts_toward_normal_limit boolean not null default true;

alter table public.card_catalog
  drop constraint if exists card_catalog_target_scope_check,
  drop constraint if exists card_catalog_disposition_check;

alter table public.card_catalog
  add constraint card_catalog_target_scope_check
    check (target_scope in ('self', 'opponent', 'either', 'all_players', 'event', 'none')),
  add constraint card_catalog_disposition_check
    check (disposition in ('consume', 'transfer', 'retain'));

update public.card_catalog
set counts_toward_normal_limit = false
where category in ('tramo', 'fiesta');

create table if not exists public.card_effects (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.card_catalog(id) on delete cascade,
  effect_key text not null check (length(btrim(effect_key)) > 0),
  operation text not null default 'add'
    check (operation in ('add', 'set', 'multiply', 'toggle', 'grant', 'block')),
  effect_value numeric,
  parameters jsonb not null default '{}'::jsonb,
  duration_type text not null default 'instant'
    check (duration_type in ('instant', 'tramo_end', 'next_tramo_end', 'match_end', 'timed', 'charges', 'permanent')),
  duration_value integer check (duration_value is null or duration_value > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint card_effects_normal_limit_check check (
    effect_key <> 'normal_card_limit'
    or (operation = 'add' and effect_value is not null and effect_value = trunc(effect_value))
  )
);
create index if not exists card_effects_card_active_idx
  on public.card_effects(card_id, is_active, sort_order);

create table if not exists public.player_effects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  applied_by uuid references public.profiles(id) on delete set null,
  source_card_instance_id uuid references public.player_cards(id) on delete set null,
  effect_key text not null check (length(btrim(effect_key)) > 0),
  operation text not null check (operation in ('add', 'set', 'multiply', 'toggle', 'grant', 'block')),
  effect_value numeric,
  parameters jsonb not null default '{}'::jsonb,
  duration_type text not null check (duration_type in ('instant', 'tramo_end', 'next_tramo_end', 'match_end', 'timed', 'charges', 'permanent')),
  duration_value integer check (duration_value is null or duration_value > 0),
  expires_at timestamptz,
  expires_after_tramo integer check (expires_after_tramo is null or expires_after_tramo >= 0),
  remaining_uses integer check (remaining_uses is null or remaining_uses >= 0),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint player_effects_normal_limit_check check (
    effect_key <> 'normal_card_limit'
    or (operation = 'add' and effect_value is not null and effect_value = trunc(effect_value))
  )
);
create index if not exists player_effects_active_owner_key_idx
  on public.player_effects(owner_id, effect_key) where status = 'active';

create table if not exists public.roulette_pools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(btrim(slug)) > 0),
  name text not null,
  description text not null default '',
  pool_type text not null check (pool_type in ('standard', 'legendary', 'fiesta', 'event')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.roulette_pools (slug, name, description, pool_type)
values
  ('normal', 'Ruleta normal', 'Ruleta principal de cartas TypeLink 2.', 'standard'),
  ('legendary', 'Ruleta legendaria', 'Ruleta desbloqueable con cartas de acceso especiales.', 'legendary'),
  ('fiesta', 'Ruleta Fiesta', 'Ruleta de desafíos y cartas de la categoría Fiesta.', 'fiesta')
on conflict (slug) do nothing;

create table if not exists public.roulette_pool_cards (
  pool_id uuid not null references public.roulette_pools(id) on delete cascade,
  card_id uuid not null references public.card_catalog(id) on delete cascade,
  weight integer not null default 1 check (weight > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (pool_id, card_id)
);
create index if not exists roulette_pool_cards_active_pool_idx
  on public.roulette_pool_cards(pool_id, is_active);

create table if not exists public.player_roulette_unlocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  pool_id uuid not null references public.roulette_pools(id) on delete restrict,
  source_card_instance_id uuid references public.player_cards(id) on delete set null,
  spins_granted integer not null default 1 check (spins_granted > 0),
  spins_used integer not null default 0 check (spins_used >= 0 and spins_used <= spins_granted),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists player_roulette_unlocks_available_idx
  on public.player_roulette_unlocks(owner_id, pool_id, expires_at)
  where spins_used < spins_granted;

create table if not exists public.card_evolution_rules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(btrim(slug)) > 0),
  name text not null,
  description text not null default '',
  result_card_id uuid not null references public.card_catalog(id) on delete restrict,
  same_tramo_only boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists card_evolution_rules_active_idx
  on public.card_evolution_rules(is_active, slug);

create table if not exists public.card_evolution_ingredients (
  rule_id uuid not null references public.card_evolution_rules(id) on delete cascade,
  card_id uuid not null references public.card_catalog(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  primary key (rule_id, card_id)
);

create table if not exists public.card_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  card_instance_id uuid references public.player_cards(id) on delete set null,
  activity_type text not null check (activity_type in (
    'card_draw', 'tramo_award', 'play', 'transfer', 'consume',
    'evolution', 'roulette_unlock', 'roulette_spin',
    'effect_applied', 'effect_expired'
  )),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists card_activity_created_idx on public.card_activity(created_at desc);
create index if not exists card_activity_actor_idx on public.card_activity(actor_id, created_at desc);
create index if not exists card_activity_target_idx on public.card_activity(target_id, created_at desc);

alter table public.card_effects enable row level security;
alter table public.player_effects enable row level security;
alter table public.roulette_pools enable row level security;
alter table public.roulette_pool_cards enable row level security;
alter table public.player_roulette_unlocks enable row level security;
alter table public.card_evolution_rules enable row level security;
alter table public.card_evolution_ingredients enable row level security;
alter table public.card_activity enable row level security;

revoke all on table
  public.card_effects, public.player_effects, public.roulette_pools,
  public.roulette_pool_cards, public.player_roulette_unlocks,
  public.card_evolution_rules, public.card_evolution_ingredients, public.card_activity
from anon, authenticated;

grant select on table
  public.card_effects, public.player_effects, public.roulette_pools,
  public.roulette_pool_cards, public.player_roulette_unlocks,
  public.card_evolution_rules, public.card_evolution_ingredients, public.card_activity
to authenticated;

create policy "Signed-in users can view active card effects"
  on public.card_effects for select to authenticated
  using (is_active = true and exists (
    select 1 from public.card_catalog cc where cc.id = card_id and cc.is_active = true
  ));
create policy "Signed-in users can view active player effects"
  on public.player_effects for select to authenticated using (true);
create policy "Signed-in users can view active roulette pools"
  on public.roulette_pools for select to authenticated using (is_active = true);
create policy "Signed-in users can view active roulette pool cards"
  on public.roulette_pool_cards for select to authenticated
  using (is_active = true and exists (
    select 1 from public.roulette_pools rp
    join public.card_catalog cc on cc.id = roulette_pool_cards.card_id
    where rp.id = roulette_pool_cards.pool_id and rp.is_active = true and cc.is_active = true
  ));
create policy "Users can view their own roulette unlocks"
  on public.player_roulette_unlocks for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Signed-in users can view active evolution rules"
  on public.card_evolution_rules for select to authenticated using (is_active = true);
create policy "Signed-in users can view active evolution ingredients"
  on public.card_evolution_ingredients for select to authenticated
  using (exists (
    select 1 from public.card_evolution_rules er where er.id = rule_id and er.is_active = true
  ));
create policy "Signed-in users can view card activity"
  on public.card_activity for select to authenticated using (true);

create or replace function app_private.draw_random_card_core()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_base_limit integer;
  v_current_tramo integer;
  v_bonus integer := 0;
  v_limit integer;
  v_count integer;
  v_card public.card_catalog%rowtype;
  v_instance uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para girar la ruleta.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select normal_card_limit, current_tramo into v_base_limit, v_current_tramo
  from public.event_settings where singleton = true;
  v_base_limit := coalesce(v_base_limit, 5);
  v_current_tramo := coalesce(v_current_tramo, 0);

  select coalesce(sum(pe.effect_value), 0)::integer into v_bonus
  from public.player_effects pe
  where pe.owner_id = v_user and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add' and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_current_tramo);

  v_limit := greatest(v_base_limit + v_bonus, 0);

  select count(*) into v_count
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = v_user and cc.counts_toward_normal_limit = true;

  if v_count >= v_limit then
    raise exception 'Tu baraja está completa. Tu límite efectivo es de % cartas normales.', v_limit using errcode = 'P0001';
  end if;

  select * into v_card from public.card_catalog
  where category = 'normal' and is_active = true
  order by pg_catalog.random() limit 1;
  if not found then
    raise exception 'No hay cartas normales activas en el catálogo.' using errcode = 'P0002';
  end if;

  insert into public.player_cards(owner_id, card_id, source)
  values (v_user, v_card.id, 'roulette') returning id into v_instance;

  return pg_catalog.jsonb_build_object(
    'player_card_id', v_instance, 'card_id', v_card.id, 'slug', v_card.slug,
    'name', v_card.name, 'rarity', v_card.rarity, 'category', v_card.category,
    'description', v_card.description, 'image_path', v_card.image_path,
    'obtained_at', pg_catalog.now(), 'normal_count', v_count + 1,
    'normal_limit_base', v_base_limit, 'normal_limit_bonus', v_bonus, 'normal_limit', v_limit
  );
end;
$function$;

grant execute on function public.draw_random_card() to authenticated;
grant execute on function app_private.draw_random_card_core() to authenticated;
revoke execute on function app_private.draw_random_card_core() from public, anon;
