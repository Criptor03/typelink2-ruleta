create or replace function app_private.admin_delete_card_core(p_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_card public.card_catalog%rowtype;
  v_inventory_count integer;
  v_evolution_count integer;
begin
  perform app_private.require_admin();

  if p_card_id is null then
    raise exception 'Debes seleccionar una carta.' using errcode = '22023';
  end if;

  select * into v_card
  from public.card_catalog
  where id = p_card_id
  for update;

  if not found then
    raise exception 'La carta ya no existe en el catálogo.' using errcode = 'P0002';
  end if;

  select count(*) into v_inventory_count
  from public.player_cards
  where card_id = p_card_id;

  if v_inventory_count > 0 then
    raise exception 'No se puede borrar «%»: ya existen % copias registradas en inventarios. Desactívala para impedir nuevas apariciones y conservar el historial.',
      v_card.name, v_inventory_count using errcode = '23503';
  end if;

  select
    (select count(*) from public.card_evolution_rules where source_card_id = p_card_id or result_card_id = p_card_id)
    +
    (select count(*) from public.card_evolution_ingredients where card_id = p_card_id)
  into v_evolution_count;

  if v_evolution_count > 0 then
    raise exception 'No se puede borrar «%»: está conectada a % regla(s) de evolución. Retira primero esas conexiones desde el módulo de evoluciones.',
      v_card.name, v_evolution_count using errcode = '23503';
  end if;

  -- Effects and roulette memberships are configuration attached to this unused card.
  -- Their foreign keys cascade when the catalog entry is removed.
  delete from public.card_catalog where id = p_card_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'deleted_card_id', p_card_id,
    'deleted_slug', v_card.slug,
    'deleted_name', v_card.name
  );
end;
$function$;

create or replace function public.admin_delete_card(p_card_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_delete_card_core(p_card_id);
$function$;

revoke all on function app_private.admin_delete_card_core(uuid) from public, anon;
grant execute on function app_private.admin_delete_card_core(uuid) to authenticated;
revoke all on function public.admin_delete_card(uuid) from public, anon;
grant execute on function public.admin_delete_card(uuid) to authenticated;

drop policy if exists "Only TypeLink administrators can delete card art" on storage.objects;
create policy "Only TypeLink administrators can delete card art"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'typelink-card-art'
  and (storage.foldername(name))[1] = 'cards'
  and public.is_current_user_admin()
);
