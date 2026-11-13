
CREATE OR REPLACE FUNCTION app_private.get_my_roulette_unlocks_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para consultar tus accesos.' using errcode = '28000';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'pool_slug',rp.slug,
          'spins_granted',pu.spins_granted,
          'spins_used',pu.spins_used,
          'expires_at',pu.expires_at,
          'created_at',pu.created_at
        )
        order by pu.created_at,pu.id
      ),
      '[]'::jsonb
    )
    from public.player_roulette_unlocks pu
    join public.roulette_pools rp on rp.id=pu.pool_id
    where pu.owner_id=v_user
      and pu.spins_used<pu.spins_granted
      and (pu.expires_at is null or pu.expires_at>pg_catalog.now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_roulette_unlocks()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.get_my_roulette_unlocks_core();
$function$;

REVOKE ALL ON FUNCTION app_private.get_my_roulette_unlocks_core() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_my_roulette_unlocks_core() TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_roulette_unlocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_roulette_unlocks() TO authenticated;
