-- Seed the existing roulette configuration from the current catalogue.
-- Legendary and Fiesta stay disabled until cards are assigned in the editor.
insert into public.roulette_pool_cards(pool_id, card_id, weight, is_active)
select rp.id, cc.id, 1, true
from public.roulette_pools rp
join public.card_catalog cc
  on cc.category = 'normal'
 and cc.rarity <> 'legendary'
 and cc.is_active = true
where rp.slug = 'normal'
on conflict (pool_id, card_id) do nothing;

update public.roulette_pools rp
set is_active = false
where rp.slug in ('legendary', 'fiesta')
  and not exists (
    select 1 from public.roulette_pool_cards rpc
    where rpc.pool_id = rp.id and rpc.is_active = true
  );

create or replace function app_private.admin_list_roulette_pools_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform app_private.require_admin();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rp.id,
        'slug', rp.slug,
        'name', rp.name,
        'description', rp.description,
        'pool_type', rp.pool_type,
        'is_active', rp.is_active,
        'cards', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', cc.id,
              'slug', cc.slug,
              'name', cc.name,
              'category', cc.category,
              'rarity', cc.rarity,
              'description', cc.description,
              'image_path', cc.image_path,
              'uses_per_card', cc.uses_per_card,
              'catalog_active', cc.is_active,
              'weight', rpc.weight,
              'is_active', rpc.is_active
            )
            order by cc.name
          )
          from public.roulette_pool_cards rpc
          join public.card_catalog cc on cc.id = rpc.card_id
          where rpc.pool_id = rp.id
        ), '[]'::jsonb),
        'eligible_cards', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', cc.id,
              'slug', cc.slug,
              'name', cc.name,
              'category', cc.category,
              'rarity', cc.rarity,
              'description', cc.description,
              'image_path', cc.image_path,
              'uses_per_card', cc.uses_per_card,
              'is_active', cc.is_active
            )
            order by cc.name
          )
          from public.card_catalog cc
          where
            (rp.slug = 'normal' and cc.category = 'normal' and cc.rarity <> 'legendary')
            or (rp.slug = 'legendary' and cc.category = 'normal' and cc.rarity = 'legendary')
            or (rp.slug = 'fiesta' and cc.category = 'fiesta')
        ), '[]'::jsonb)
      )
      order by case rp.slug when 'normal' then 1 when 'legendary' then 2 when 'fiesta' then 3 else 4 end
    ),
    '[]'::jsonb
  )
  into v_result
  from public.roulette_pools rp
  where rp.slug in ('normal', 'legendary', 'fiesta');

  return v_result;
end;
$function$;

create or replace function app_private.admin_save_roulette_pool_core(
  p_pool_slug text,
  p_is_active boolean,
  p_description text,
  p_cards jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pool public.roulette_pools%rowtype;
  v_item jsonb;
  v_card public.card_catalog%rowtype;
  v_card_id uuid;
  v_weight integer;
  v_member_active boolean;
  v_total integer := 0;
  v_active integer := 0;
  v_added integer := 0;
begin
  perform app_private.require_admin();

  if p_pool_slug not in ('normal', 'legendary', 'fiesta') then
    raise exception 'La ruleta seleccionada no es válida.' using errcode = '22023';
  end if;
  if p_is_active is null then
    raise exception 'Debes indicar si la ruleta estará activa.' using errcode = '22023';
  end if;
  if p_description is null or pg_catalog.length(p_description) > 500 then
    raise exception 'La descripción no puede superar los 500 caracteres.' using errcode = '22023';
  end if;
  if p_cards is null or pg_catalog.jsonb_typeof(p_cards) <> 'array' then
    raise exception 'La lista de cartas de la ruleta no es válida.' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_cards) > 200 then
    raise exception 'Una ruleta no puede tener más de 200 cartas configuradas.' using errcode = '22023';
  end if;

  select * into v_pool
  from public.roulette_pools
  where slug = p_pool_slug
  for update;

  if not found then
    raise exception 'No encontramos esta ruleta en la configuración.' using errcode = 'P0002';
  end if;

  if (
    select count(*) <> count(distinct value->>'card_id')
    from jsonb_array_elements(p_cards)
  ) then
    raise exception 'No puedes incluir la misma carta dos veces en una ruleta.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_cards)
  loop
    begin
      v_card_id := (v_item->>'card_id')::uuid;
      v_weight := coalesce(nullif(v_item->>'weight', '')::integer, 1);
      v_member_active := coalesce(nullif(v_item->>'is_active', '')::boolean, true);
    exception when others then
      raise exception 'Una carta de la lista contiene datos no válidos.' using errcode = '22023';
    end;

    if v_weight < 1 or v_weight > 10000 then
      raise exception 'El peso de cada carta debe estar entre 1 y 10000.' using errcode = '22023';
    end if;

    select * into v_card
    from public.card_catalog
    where id = v_card_id
    for share;

    if not found then
      raise exception 'Una de las cartas seleccionadas ya no existe en el catálogo.' using errcode = 'P0002';
    end if;

    if p_pool_slug = 'normal'
       and not (v_card.category = 'normal' and v_card.rarity <> 'legendary') then
      raise exception 'La ruleta normal solo admite cartas normales comunes, raras o épicas.' using errcode = '22023';
    elsif p_pool_slug = 'legendary'
       and not (v_card.category = 'normal' and v_card.rarity = 'legendary') then
      raise exception 'La ruleta legendaria solo admite cartas normales de rareza legendaria.' using errcode = '22023';
    elsif p_pool_slug = 'fiesta'
       and v_card.category <> 'fiesta' then
      raise exception 'La ruleta Fiesta solo admite cartas de la categoría Fiesta.' using errcode = '22023';
    end if;

    if v_member_active and not v_card.is_active then
      raise exception 'La carta «%» está desactivada en el catálogo. Actívala allí antes de habilitarla en la ruleta.', v_card.name using errcode = '22023';
    end if;

    v_total := v_total + 1;
    if v_member_active then
      v_active := v_active + 1;
    end if;
  end loop;

  if p_is_active and v_active = 0 then
    raise exception 'No puedes activar esta ruleta sin al menos una carta habilitada.' using errcode = '22023';
  end if;

  delete from public.roulette_pool_cards
  where pool_id = v_pool.id;

  for v_item in select value from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item->>'card_id')::uuid;
    v_weight := coalesce(nullif(v_item->>'weight', '')::integer, 1);
    v_member_active := coalesce(nullif(v_item->>'is_active', '')::boolean, true);

    insert into public.roulette_pool_cards(pool_id, card_id, weight, is_active)
    values (v_pool.id, v_card_id, v_weight, v_member_active);

    v_added := v_added + 1;
  end loop;

  update public.roulette_pools
  set description = p_description,
      is_active = p_is_active
  where id = v_pool.id;

  return jsonb_build_object(
    'success', true,
    'pool_slug', p_pool_slug,
    'cards_saved', v_added,
    'active_cards', v_active,
    'pool_active', p_is_active,
    'configuration', app_private.admin_list_roulette_pools_core()
  );
end;
$function$;

create or replace function public.admin_list_roulette_pools()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_list_roulette_pools_core();
$function$;

create or replace function public.admin_save_roulette_pool(
  p_pool_slug text,
  p_is_active boolean,
  p_description text,
  p_cards jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_save_roulette_pool_core(
    p_pool_slug, p_is_active, p_description, p_cards
  );
$function$;

create or replace function public.get_active_roulette_cards(p_pool_slug text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cc.id,
        'slug', cc.slug,
        'name', cc.name,
        'category', cc.category,
        'rarity', cc.rarity,
        'description', cc.description,
        'image_path', cc.image_path,
        'uses_per_card', cc.uses_per_card,
        'weight', rpc.weight
      )
      order by cc.name
    ),
    '[]'::jsonb
  )
  from public.roulette_pools rp
  join public.roulette_pool_cards rpc on rpc.pool_id = rp.id
  join public.card_catalog cc on cc.id = rpc.card_id
  where rp.slug = p_pool_slug
    and rp.is_active = true
    and rpc.is_active = true
    and cc.is_active = true
    and (
      (p_pool_slug = 'normal' and cc.category = 'normal' and cc.rarity <> 'legendary')
      or (p_pool_slug = 'legendary' and cc.category = 'normal' and cc.rarity = 'legendary')
      or (p_pool_slug = 'fiesta' and cc.category = 'fiesta')
    );
$function$;

revoke all on function app_private.admin_list_roulette_pools_core() from public, anon;
revoke all on function app_private.admin_save_roulette_pool_core(text, boolean, text, jsonb) from public, anon;
grant execute on function app_private.admin_list_roulette_pools_core() to authenticated;
grant execute on function app_private.admin_save_roulette_pool_core(text, boolean, text, jsonb) to authenticated;

revoke all on function public.admin_list_roulette_pools() from public, anon;
revoke all on function public.admin_save_roulette_pool(text, boolean, text, jsonb) from public, anon;
revoke all on function public.get_active_roulette_cards(text) from public, anon;
grant execute on function public.admin_list_roulette_pools() to authenticated;
grant execute on function public.admin_save_roulette_pool(text, boolean, text, jsonb) to authenticated;
grant execute on function public.get_active_roulette_cards(text) to authenticated;

create or replace function app_private.draw_normal_card_with_tramo_credit_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  v_selected_weight integer := 1;
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
    and pc.remaining_uses > 0
    and cc.category = 'normal'
    and cc.counts_toward_normal_limit = true;

  if v_normal_count >= v_limit then
    raise exception 'Tu baraja está completa. Tu límite efectivo es de % cartas normales.', v_limit using errcode = 'P0001';
  end if;

  select cc.*
    into v_card
  from public.roulette_pools rp
  join public.roulette_pool_cards rpc on rpc.pool_id = rp.id
  join public.card_catalog cc on cc.id = rpc.card_id
  where rp.slug = 'normal'
    and rp.is_active = true
    and rpc.is_active = true
    and cc.category = 'normal'
    and cc.rarity <> 'legendary'
    and cc.is_active = true
  order by pg_catalog.random() ^ (1.0 / rpc.weight) desc
  limit 1;

  if not found then
    raise exception 'La ruleta normal no tiene cartas activas. Configúrala desde Administración → Ruletas.' using errcode = 'P0002';
  end if;

  select rpc.weight into v_selected_weight
  from public.roulette_pool_cards rpc
  join public.roulette_pools rp on rp.id = rpc.pool_id
  where rp.slug = 'normal' and rpc.card_id = v_card.id;

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
      'roulette_pool', 'normal',
      'roulette_weight', v_selected_weight,
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
    'bonus_spins_remaining', v_progress.bonus_spins_remaining,
    'roulette_pool', 'normal',
    'roulette_weight', v_selected_weight
  );
end;
$function$;
