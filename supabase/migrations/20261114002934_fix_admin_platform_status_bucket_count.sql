create or replace function app_private.admin_get_platform_status_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_database_bytes bigint;
  v_storage_bytes bigint;
  v_storage_objects bigint;
  v_bucket_count integer;
  v_auth_users bigint;
  v_profiles bigint;
  v_public_tables bigint;
  v_cards_total bigint;
  v_cards_active bigint;
  v_activities_total bigint;
  v_activities_7d bigint;
  v_last_activity timestamptz;
  v_buckets jsonb;
  v_recent_files jsonb;
  v_roulettes jsonb;
  v_event_settings jsonb;
begin
  perform app_private.require_admin();
  v_database_bytes := pg_catalog.pg_database_size(pg_catalog.current_database());

  select count(*)::bigint into v_public_tables
  from information_schema.tables where table_schema='public' and table_type='BASE TABLE';
  select count(*)::bigint into v_auth_users from auth.users;
  select count(*)::bigint into v_profiles from public.profiles;

  select count(*)::bigint,count(*) filter (where cc.is_active)::bigint
    into v_cards_total,v_cards_active
  from public.card_catalog cc;

  select count(*)::bigint,
         count(*) filter (where ca.created_at >= pg_catalog.now()-interval '7 days')::bigint,
         max(ca.created_at)
    into v_activities_total,v_activities_7d,v_last_activity
  from public.card_activity ca;

  select count(*)::integer into v_bucket_count from storage.buckets;

  select count(*)::bigint,
         coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0::bigint end),0)::bigint
    into v_storage_objects,v_storage_bytes
  from storage.objects o
  where o.archived_at is null and coalesce(o.is_delete_marker,false)=false;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name',bucket_summary.name,'is_public',bucket_summary.is_public,
    'file_count',bucket_summary.file_count,'size_bytes',bucket_summary.size_bytes,
    'latest_upload_at',bucket_summary.latest_upload_at
  ) order by bucket_summary.name),'[]'::jsonb)
  into v_buckets
  from (
    select b.name,b.public as is_public,count(o.id)::bigint as file_count,
      coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0::bigint end),0)::bigint as size_bytes,
      max(o.created_at) as latest_upload_at
    from storage.buckets b
    left join storage.objects o on o.bucket_id=b.id and o.archived_at is null and coalesce(o.is_delete_marker,false)=false
    group by b.id,b.name,b.public
  ) bucket_summary;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'bucket',recent.bucket_name,'name',recent.name,'size_bytes',recent.size_bytes,'created_at',recent.created_at
  ) order by recent.created_at desc),'[]'::jsonb)
  into v_recent_files
  from (
    select b.name as bucket_name,o.name,
      case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0::bigint end as size_bytes,
      o.created_at
    from storage.objects o join storage.buckets b on b.id=o.bucket_id
    where o.archived_at is null and coalesce(o.is_delete_marker,false)=false
    order by o.created_at desc limit 10
  ) recent;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'slug',pool_summary.slug,'name',pool_summary.name,'is_active',pool_summary.is_active,
    'configured_cards',pool_summary.configured_cards,'active_cards',pool_summary.active_cards
  ) order by pool_summary.slug),'[]'::jsonb)
  into v_roulettes
  from (
    select rp.slug,rp.name,rp.is_active,count(rpc.card_id)::bigint as configured_cards,
      count(rpc.card_id) filter (where rpc.is_active)::bigint as active_cards
    from public.roulette_pools rp
    left join public.roulette_pool_cards rpc on rpc.pool_id=rp.id
    group by rp.id,rp.slug,rp.name,rp.is_active
  ) pool_summary;

  select pg_catalog.to_jsonb(es) into v_event_settings
  from public.event_settings es where es.singleton=true limit 1;

  return pg_catalog.jsonb_build_object(
    'checked_at',pg_catalog.clock_timestamp(),
    'database',pg_catalog.jsonb_build_object('status','online','name',pg_catalog.current_database(),
      'size_bytes',v_database_bytes,'size_pretty',pg_catalog.pg_size_pretty(v_database_bytes),'public_tables',v_public_tables),
    'auth',pg_catalog.jsonb_build_object('status','online','users',v_auth_users,'profiles',v_profiles),
    'storage',pg_catalog.jsonb_build_object('status','online','bucket_count',v_bucket_count,'object_count',v_storage_objects,
      'size_bytes',v_storage_bytes,'buckets',v_buckets,'recent_files',v_recent_files),
    'catalog',pg_catalog.jsonb_build_object('total',v_cards_total,'active',v_cards_active,'inactive',v_cards_total-v_cards_active),
    'roulettes',v_roulettes,
    'activity',pg_catalog.jsonb_build_object('total',v_activities_total,'last_7_days',v_activities_7d,'last_activity_at',v_last_activity),
    'event_settings',coalesce(v_event_settings,'{}'::jsonb)
  );
end;
$function$;