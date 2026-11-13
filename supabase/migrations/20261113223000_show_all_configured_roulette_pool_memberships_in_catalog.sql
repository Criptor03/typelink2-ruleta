CREATE OR REPLACE FUNCTION app_private.admin_list_catalog_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform app_private.require_admin();
  return (
    select coalesce(
      jsonb_agg(
        pg_catalog.to_jsonb(cc) || pg_catalog.jsonb_build_object(
          'has_active_evolution', exists (
            select 1 from public.card_evolution_rules er
            where er.source_card_id = cc.id and er.is_active = true
          ),
          'roulette_pools', coalesce((
            select pg_catalog.jsonb_agg(active_pools.slug order by active_pools.slug)
            from (
              select distinct rp.slug
              from public.roulette_pool_cards rpc
              join public.roulette_pools rp on rp.id = rpc.pool_id
              where rpc.card_id = cc.id
            ) active_pools
          ), '[]'::jsonb)
        )
        order by cc.category, cc.rarity, cc.name
      ),
      '[]'::jsonb
    )
    from public.card_catalog cc
  );
end;
$function$
;
