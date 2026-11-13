-- TypeLink 2: per-card use counters and one-to-one card evolution.
-- Additive migration. Existing inventory, card IDs, and illustration paths stay intact.

alter table public.card_catalog
  add column if not exists uses_per_card integer not null default 1;
alter table public.card_catalog
  drop constraint if exists card_catalog_uses_per_card_check;
alter table public.card_catalog
  add constraint card_catalog_uses_per_card_check
  check (uses_per_card between 1 and 99);

alter table public.player_cards
  add column if not exists remaining_uses integer not null default 1;
update public.player_cards pc
set remaining_uses = case when pc.status = 'used' then 0 else cc.uses_per_card end
from public.card_catalog cc
where cc.id = pc.card_id;
alter table public.player_cards
  drop constraint if exists player_cards_remaining_uses_status_check;
alter table public.player_cards
  add constraint player_cards_remaining_uses_status_check
  check (
    remaining_uses >= 0 and (
      (status = 'available' and remaining_uses > 0)
      or (status = 'used' and remaining_uses = 0)
    )
  );

alter table public.card_catalog
  drop constraint if exists card_catalog_disposition_check;
alter table public.card_catalog
  add constraint card_catalog_disposition_check
  check (disposition in ('consume', 'transfer'));

alter table public.player_cards
  drop constraint if exists player_cards_source_check;
alter table public.player_cards
  add constraint player_cards_source_check
  check (source in ('roulette', 'tramo', 'admin', 'evolution'));

alter table public.card_evolution_rules
  add column if not exists source_card_id uuid;
alter table public.card_evolution_rules
  alter column source_card_id set not null;
alter table public.card_evolution_rules
  add constraint card_evolution_rules_source_card_id_fkey
  foreign key (source_card_id) references public.card_catalog(id) on delete restrict;
alter table public.card_evolution_rules
  add constraint card_evolution_rules_source_result_different_check
  check (source_card_id <> result_card_id);
create unique index if not exists card_evolution_rules_source_card_uidx
  on public.card_evolution_rules(source_card_id);
create index if not exists card_evolution_rules_source_active_idx
  on public.card_evolution_rules(source_card_id, is_active);

create or replace function app_private.spend_card_use_before_update()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old.status = 'available'
     and new.status = 'used'
     and new.remaining_uses = old.remaining_uses then
    if old.remaining_uses > 1 then
      new.remaining_uses := old.remaining_uses - 1;
      new.status := 'available';
    else
      new.remaining_uses := 0;
      new.status := 'used';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists spend_card_use_before_update on public.player_cards;
create trigger spend_card_use_before_update
before update of status on public.player_cards
for each row execute function app_private.spend_card_use_before_update();

CREATE OR REPLACE FUNCTION app_private.draw_random_card_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  select normal_card_limit, current_tramo
    into v_base_limit, v_current_tramo
  from public.event_settings
  where singleton = true;

  v_base_limit := coalesce(v_base_limit, 5);
  v_current_tramo := coalesce(v_current_tramo, 0);

  select coalesce(sum(pe.effect_value), 0)::integer
    into v_bonus
  from public.player_effects pe
  where pe.owner_id = v_user
    and pe.effect_key = 'normal_card_limit'
    and pe.operation = 'add'
    and pe.status = 'active'
    and (pe.expires_at is null or pe.expires_at > pg_catalog.now())
    and (pe.expires_after_tramo is null or pe.expires_after_tramo >= v_current_tramo);

  v_limit := greatest(v_base_limit + v_bonus, 0);

  select count(*) into v_count
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.owner_id = v_user
    and pc.status = 'available'
    and cc.counts_toward_normal_limit = true;

  if v_count >= v_limit then
    raise exception 'Tu baraja está completa. Tu límite efectivo es de % cartas normales.', v_limit using errcode = 'P0001';
  end if;

  select * into v_card
  from public.card_catalog
  where category = 'normal' and is_active = true
  order by pg_catalog.random()
  limit 1;

  if not found then
    raise exception 'No hay cartas normales activas en el catálogo.' using errcode = 'P0002';
  end if;

  insert into public.player_cards(owner_id, card_id, source, remaining_uses)
  values (v_user, v_card.id, 'roulette', v_card.uses_per_card)
  returning id into v_instance;

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
    'normal_count', v_count + 1,
    'normal_limit_base', v_base_limit,
    'normal_limit_bonus', v_bonus,
    'normal_limit', v_limit
  );
end;
$function$


CREATE OR REPLACE FUNCTION app_private.issue_tramo_cards_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_tramo integer;
  v_card public.card_catalog%rowtype;
  v_instance uuid;
  v_added jsonb := '[]'::jsonb;
  v_seen integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para recibir cartas de tramo.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select coalesce(max(tramo_number), 0) + 1
    into v_tramo
  from public.player_cards
  where owner_id = v_user and source = 'tramo';

  for v_card in
    select * from public.card_catalog
    where category = 'tramo' and is_active = true
    order by slug
    limit 2
  loop
    insert into public.player_cards(owner_id, card_id, source, tramo_number, remaining_uses)
    values (v_user, v_card.id, 'tramo', v_tramo, v_card.uses_per_card)
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

  return pg_catalog.jsonb_build_object('tramo_number', v_tramo, 'cards', v_added);
end;
$function$


CREATE OR REPLACE FUNCTION public.play_card(p_card_instance_id uuid, p_target_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
  v_status text;
  v_remaining integer;
begin
  v_result := app_private.play_card_core(p_card_instance_id, p_target_id);

  select pc.status, pc.remaining_uses
    into v_status, v_remaining
  from public.player_cards pc
  where pc.id = (v_result ->> 'card_instance_id')::uuid;

  return v_result || pg_catalog.jsonb_build_object(
    'status', v_status,
    'remaining_uses', v_remaining
  );
end;
$function$


CREATE OR REPLACE FUNCTION app_private.evolve_card_core(p_card_instance_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_source record;
  v_rule record;
  v_result_card public.card_catalog%rowtype;
  v_new_instance uuid;
  v_current_tramo integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para evolucionar una carta.' using errcode = '28000';
  end if;

  if p_card_instance_id is null then
    raise exception 'Debes seleccionar la carta que quieres evolucionar.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select
    pc.id as instance_id,
    pc.owner_id,
    pc.card_id,
    pc.status,
    pc.remaining_uses,
    pc.tramo_number,
    cc.slug,
    cc.name,
    cc.rarity,
    cc.description,
    cc.image_path
  into v_source
  from public.player_cards pc
  join public.card_catalog cc on cc.id = pc.card_id
  where pc.id = p_card_instance_id
  for update of pc;

  if not found then
    raise exception 'No encontramos esa carta en tu inventario.' using errcode = 'P0002';
  end if;

  if v_source.owner_id <> v_user then
    raise exception 'Solo puedes evolucionar cartas de tu propio inventario.' using errcode = '42501';
  end if;

  if v_source.status <> 'available' or v_source.remaining_uses <= 0 then
    raise exception 'Esta carta ya no tiene usos disponibles.' using errcode = 'P0001';
  end if;

  select er.*
    into v_rule
  from public.card_evolution_rules er
  where er.source_card_id = v_source.card_id
    and er.is_active = true
  limit 1;

  if not found then
    raise exception 'Esta carta no tiene una evolución configurada.' using errcode = 'P0002';
  end if;

  select coalesce(es.current_tramo, 0)
    into v_current_tramo
  from public.event_settings es
  where es.singleton = true;

  if v_rule.same_tramo_only and (
    v_source.tramo_number is null
    or v_source.tramo_number <> v_current_tramo
  ) then
    raise exception 'Esta evolución solo se puede realizar durante el tramo en que obtuviste la carta.' using errcode = 'P0001';
  end if;

  select *
    into v_result_card
  from public.card_catalog cc
  where cc.id = v_rule.result_card_id
    and cc.is_active = true;

  if not found then
    raise exception 'La carta resultante está desactivada o no existe.' using errcode = 'P0002';
  end if;

  update public.player_cards
  set status = 'used',
      remaining_uses = 0
  where id = v_source.instance_id;

  insert into public.player_cards(
    owner_id, card_id, source, status, remaining_uses
  )
  values (
    v_user, v_result_card.id, 'evolution', 'available', v_result_card.uses_per_card
  )
  returning id into v_new_instance;

  insert into public.card_activity(
    actor_id, target_id, card_instance_id, activity_type, details
  )
  values (
    v_user, v_user, v_source.instance_id, 'evolution',
    pg_catalog.jsonb_build_object(
      'rule_id', v_rule.id,
      'rule_slug', v_rule.slug,
      'source_instance_id', v_source.instance_id,
      'source_card_id', v_source.card_id,
      'source_slug', v_source.slug,
      'source_name', v_source.name,
      'source_image_path', v_source.image_path,
      'result_instance_id', v_new_instance,
      'result_card_id', v_result_card.id,
      'result_slug', v_result_card.slug,
      'result_name', v_result_card.name,
      'result_image_path', v_result_card.image_path,
      'result_uses', v_result_card.uses_per_card
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'action', 'evolution',
    'source_instance_id', v_source.instance_id,
    'source_card_id', v_source.card_id,
    'source_slug', v_source.slug,
    'source_name', v_source.name,
    'source_image_path', v_source.image_path,
    'source_status', 'used',
    'result_instance_id', v_new_instance,
    'result_card_id', v_result_card.id,
    'result_slug', v_result_card.slug,
    'result_name', v_result_card.name,
    'result_rarity', v_result_card.rarity,
    'result_description', v_result_card.description,
    'result_image_path', v_result_card.image_path,
    'uses_per_card', v_result_card.uses_per_card,
    'remaining_uses', v_result_card.uses_per_card
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.evolve_card(p_card_instance_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.evolve_card_core(p_card_instance_id);
$function$


revoke execute on function public.play_card(uuid, uuid) from public, anon;
grant execute on function public.play_card(uuid, uuid) to authenticated;
revoke execute on function app_private.play_card_core(uuid, uuid) from public, anon;
grant execute on function app_private.play_card_core(uuid, uuid) to authenticated;
revoke execute on function public.evolve_card(uuid) from public, anon;
grant execute on function public.evolve_card(uuid) to authenticated;
revoke execute on function app_private.evolve_card_core(uuid) from public, anon;
grant execute on function app_private.evolve_card_core(uuid) to authenticated;
