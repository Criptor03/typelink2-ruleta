create table if not exists app_private.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text
);

revoke all on table app_private.admin_users from public, anon, authenticated;

insert into app_private.admin_users(user_id,note)
values ('9a45f2fb-6c21-4689-9001-61c55bd363b4','Initial TypeLink 2 project owner; verified Discord account.')
on conflict(user_id) do nothing;

create or replace function app_private.is_current_user_admin_core()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from app_private.admin_users au
    where au.user_id = (select auth.uid())
  );
$function$;

create or replace function app_private.require_admin()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not app_private.is_current_user_admin_core() then
    raise exception 'No tienes permisos de administrador para realizar esta acción.'
      using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security invoker
set search_path to ''
as $function$
  select app_private.is_current_user_admin_core();
$function$;

revoke all on function app_private.is_current_user_admin_core() from public, anon;
grant execute on function app_private.is_current_user_admin_core() to authenticated;
revoke all on function app_private.require_admin() from public, anon, authenticated;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;
