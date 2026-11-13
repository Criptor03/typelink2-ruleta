-- Private card catalog management, safe admin RPCs, and public PNG storage.
create or replace function app_private.admin_list_catalog_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_admin();
  return (
    select coalesce(
      pg_catalog.jsonb_agg(pg_catalog.to_jsonb(cc) order by cc.category, cc.rarity, cc.name),
      '[]'::jsonb
    )
    from public.card_catalog cc
  );
end;
$function$;

create or replace function app_private.admin_save_card_core(p_card jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_existing public.card_catalog%rowtype;
  v_saved public.card_catalog%rowtype;
  v_slug text;
  v_name text;
  v_category text;
  v_rarity text;
  v_description text;
  v_image_path text;
  v_target_scope text;
  v_disposition text;
  v_uses integer;
  v_is_active boolean;
  v_counts_toward_normal_limit boolean;
begin
  perform app_private.require_admin();
  if p_card is null or pg_catalog.jsonb_typeof(p_card) <> 'object' then
    raise exception 'Los datos de la carta no son válidos.' using errcode = '22023';
  end if;
  if nullif(p_card->>'id', '') is not null then
    v_id := (p_card->>'id')::uuid;
    select * into v_existing from public.card_catalog where id = v_id for update;
    if not found then
      raise exception 'No encontramos la carta que intentas editar.' using errcode = 'P0002';
    end if;
  end if;

  v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'slug', '')));
  v_name := pg_catalog.btrim(coalesce(p_card->>'name', ''));
  v_category := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'category', '')));
  v_rarity := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'rarity', '')));
  v_description := coalesce(p_card->>'description', '');
  v_image_path := nullif(pg_catalog.btrim(coalesce(p_card->>'image_path', '')), '');
  v_target_scope := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'target_scope', 'self')));
  v_disposition := pg_catalog.lower(pg_catalog.btrim(coalesce(p_card->>'disposition', 'consume')));
  v_uses := coalesce(nullif(p_card->>'uses_per_card', '')::integer, 1);
  v_is_active := coalesce(nullif(p_card->>'is_active', '')::boolean, true);
  v_counts_toward_normal_limit := coalesce(nullif(p_card->>'counts_toward_normal_limit', '')::boolean, true);

  if v_name = '' or pg_catalog.length(v_name) > 80 then
    raise exception 'El nombre debe tener entre 1 y 80 caracteres.' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or pg_catalog.length(v_slug) > 64 then
    raise exception 'El identificador solo puede usar letras minúsculas, números y guiones.' using errcode = '22023';
  end if;
  if v_category not in ('normal', 'tramo', 'fiesta') then
    raise exception 'La categoría seleccionada no es válida.' using errcode = '22023';
  end if;
  if not (
    (v_category = 'normal' and v_rarity in ('common', 'rare', 'epic', 'legendary'))
    or (v_category = 'tramo' and v_rarity = 'tramo')
    or (v_category = 'fiesta' and v_rarity = 'fiesta')
  ) then
    raise exception 'La rareza no corresponde con la categoría seleccionada.' using errcode = '22023';
  end if;
  if v_uses < 1 or v_uses > 99 then
    raise exception 'Los usos por carta deben estar entre 1 y 99.' using errcode = '22023';
  end if;
  if v_target_scope not in ('self', 'opponent', 'either', 'all_players', 'event', 'none') then
    raise exception 'El objetivo seleccionado no es válido.' using errcode = '22023';
  end if;
  if v_disposition not in ('consume', 'transfer') then
    raise exception 'El comportamiento de canje seleccionado no es válido.' using errcode = '22023';
  end if;
  if pg_catalog.length(v_description) > 1000 then
    raise exception 'La descripción no puede superar los 1000 caracteres.' using errcode = '22023';
  end if;
  if v_image_path is not null
     and v_image_path not like 'assets/%'
     and v_image_path not like 'https://uytdmfrynuzofkyedhve.supabase.co/storage/v1/object/public/typelink-card-art/cards/%' then
    raise exception 'La ilustración debe ser un recurso del proyecto o una imagen del almacén oficial.' using errcode = '22023';
  end if;
  if v_category <> 'normal' then
    v_counts_toward_normal_limit := false;
  end if;

  if v_id is not null then
    if v_slug <> v_existing.slug then
      raise exception 'El identificador interno no se puede cambiar después de crear la carta.' using errcode = '22023';
    end if;
    if v_category is distinct from v_existing.category and (
      exists (select 1 from public.player_cards pc where pc.card_id = v_id)
      or exists (select 1 from public.roulette_pool_cards rpc where rpc.card_id = v_id)
      or exists (select 1 from public.card_effects ce where ce.card_id = v_id)
      or exists (select 1 from public.card_evolution_rules er where er.source_card_id = v_id or er.result_card_id = v_id)
    ) then
      raise exception 'No se puede cambiar la categoría: esta carta ya está conectada a inventarios o mecánicas del evento.' using errcode = '23000';
    end if;
    update public.card_catalog
    set name = v_name, category = v_category, rarity = v_rarity,
        description = v_description, image_path = v_image_path,
        is_active = v_is_active, target_scope = v_target_scope,
        disposition = v_disposition,
        counts_toward_normal_limit = v_counts_toward_normal_limit,
        uses_per_card = v_uses
    where id = v_id
    returning * into v_saved;
  else
    insert into public.card_catalog (
      slug, name, category, rarity, description, image_path, is_active,
      target_scope, disposition, counts_toward_normal_limit, uses_per_card
    )
    values (
      v_slug, v_name, v_category, v_rarity, v_description, v_image_path, v_is_active,
      v_target_scope, v_disposition, v_counts_toward_normal_limit, v_uses
    )
    returning * into v_saved;
  end if;
  return pg_catalog.to_jsonb(v_saved);
end;
$function$;

create or replace function public.admin_list_catalog()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_list_catalog_core();
$function$;

create or replace function public.admin_save_card(p_card jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_save_card_core(p_card);
$function$;

revoke all on function app_private.admin_list_catalog_core() from public, anon;
revoke all on function app_private.admin_save_card_core(jsonb) from public, anon;
grant execute on function app_private.admin_list_catalog_core() to authenticated;
grant execute on function app_private.admin_save_card_core(jsonb) to authenticated;
revoke all on function public.admin_list_catalog() from public, anon;
revoke all on function public.admin_save_card(jsonb) from public, anon;
grant execute on function public.admin_list_catalog() to authenticated;
grant execute on function public.admin_save_card(jsonb) to authenticated;

drop policy if exists "Signed-in users can view active cards" on public.card_catalog;
create policy "Signed-in users can view active or owned cards"
on public.card_catalog for select to authenticated
using (
  is_active = true
  or exists (select 1 from public.player_cards pc where pc.card_id = card_catalog.id)
  or exists (select 1 from public.card_evolution_rules er where er.result_card_id = card_catalog.id and er.is_active = true)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('typelink-card-art', 'typelink-card-art', true, 5242880, array['image/png']::text[])
on conflict (id) do update
set name = excluded.name, public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Only TypeLink administrators can upload card art" on storage.objects;
create policy "Only TypeLink administrators can upload card art"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'typelink-card-art'
  and (storage.foldername(name))[1] = 'cards'
  and name ~ '^cards/[a-z0-9-]+/[a-z0-9-]+[.]png$'
  and public.is_current_user_admin()
);
