alter table public.event_settings
  add column if not exists typeleague_visible boolean not null default false;

create table if not exists public.typeleague_matches (
  id uuid primary key default gen_random_uuid(),
  participant_a_id uuid not null references public.profiles(id) on delete restrict,
  participant_b_id uuid not null references public.profiles(id) on delete restrict,
  winner_id uuid not null references public.profiles(id) on delete restrict,
  participant_a_pokemon_defeated integer not null default 0
    check (participant_a_pokemon_defeated between 0 and 6),
  participant_b_pokemon_defeated integer not null default 0
    check (participant_b_pokemon_defeated between 0 and 6),
  played_at timestamptz not null default now(),
  notes text not null default '' check (char_length(notes) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint typeleague_participants_must_differ
    check (participant_a_id <> participant_b_id),
  constraint typeleague_winner_must_be_a_participant
    check (winner_id = participant_a_id or winner_id = participant_b_id)
);

create index if not exists typeleague_matches_played_at_idx
  on public.typeleague_matches (played_at desc, created_at desc);
create index if not exists typeleague_matches_participant_a_idx
  on public.typeleague_matches (participant_a_id);
create index if not exists typeleague_matches_participant_b_idx
  on public.typeleague_matches (participant_b_id);
create index if not exists typeleague_matches_winner_idx
  on public.typeleague_matches (winner_id);

alter table public.typeleague_matches enable row level security;

drop policy if exists "Signed-in users can view visible TypeLeague matches"
  on public.typeleague_matches;
create policy "Signed-in users can view visible TypeLeague matches"
  on public.typeleague_matches
  for select
  to authenticated
  using (
    (select public.is_current_user_admin())
    or coalesce(
      (select es.typeleague_visible
       from public.event_settings es
       where es.singleton = true),
      false
    )
  );

revoke all on table public.typeleague_matches from anon, authenticated;
grant select on table public.typeleague_matches to authenticated;

create or replace function app_private.admin_save_typeleague_match_core(
  p_match_id uuid,
  p_participant_a_id uuid,
  p_participant_b_id uuid,
  p_winner_id uuid,
  p_participant_a_pokemon_defeated integer,
  p_participant_b_pokemon_defeated integer,
  p_played_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match public.typeleague_matches%rowtype;
  v_notes text := coalesce(p_notes, '');
begin
  perform app_private.require_admin();

  if p_participant_a_id is null or p_participant_b_id is null
     or p_participant_a_id = p_participant_b_id then
    raise exception 'Selecciona dos participantes diferentes.' using errcode = '22023';
  end if;

  if p_winner_id is null
     or p_winner_id not in (p_participant_a_id, p_participant_b_id) then
    raise exception 'El ganador debe ser uno de los dos participantes.' using errcode = '22023';
  end if;

  if p_participant_a_pokemon_defeated is null
     or p_participant_a_pokemon_defeated < 0
     or p_participant_a_pokemon_defeated > 6
     or p_participant_b_pokemon_defeated is null
     or p_participant_b_pokemon_defeated < 0
     or p_participant_b_pokemon_defeated > 6 then
    raise exception 'Los Pokémon derrotados deben estar entre 0 y 6 para cada participante.' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_notes) > 500 then
    raise exception 'Las notas no pueden superar los 500 caracteres.' using errcode = '22023';
  end if;

  if not exists(select 1 from public.profiles where id = p_participant_a_id)
     or not exists(select 1 from public.profiles where id = p_participant_b_id) then
    raise exception 'Uno de los participantes ya no existe.' using errcode = '23503';
  end if;

  if p_match_id is null then
    insert into public.typeleague_matches (
      participant_a_id,
      participant_b_id,
      winner_id,
      participant_a_pokemon_defeated,
      participant_b_pokemon_defeated,
      played_at,
      notes,
      created_by
    )
    values (
      p_participant_a_id,
      p_participant_b_id,
      p_winner_id,
      p_participant_a_pokemon_defeated,
      p_participant_b_pokemon_defeated,
      coalesce(p_played_at, pg_catalog.now()),
      v_notes,
      (select auth.uid())
    )
    returning * into v_match;
  else
    update public.typeleague_matches
    set participant_a_id = p_participant_a_id,
        participant_b_id = p_participant_b_id,
        winner_id = p_winner_id,
        participant_a_pokemon_defeated = p_participant_a_pokemon_defeated,
        participant_b_pokemon_defeated = p_participant_b_pokemon_defeated,
        played_at = coalesce(p_played_at, played_at),
        notes = v_notes,
        updated_at = pg_catalog.now()
    where id = p_match_id
    returning * into v_match;

    if not found then
      raise exception 'No encontramos el enfrentamiento que quieres modificar.' using errcode = 'P0002';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'match_id', v_match.id,
    'created', p_match_id is null
  );
end;
$function$;

revoke all on function app_private.admin_save_typeleague_match_core(
  uuid, uuid, uuid, uuid, integer, integer, timestamptz, text
) from public, anon;
grant execute on function app_private.admin_save_typeleague_match_core(
  uuid, uuid, uuid, uuid, integer, integer, timestamptz, text
) to authenticated;

create or replace function public.admin_save_typeleague_match(
  p_match_id uuid,
  p_participant_a_id uuid,
  p_participant_b_id uuid,
  p_winner_id uuid,
  p_participant_a_pokemon_defeated integer,
  p_participant_b_pokemon_defeated integer,
  p_played_at timestamptz,
  p_notes text
)
returns jsonb
language sql
set search_path = ''
as $function$
  select app_private.admin_save_typeleague_match_core(
    p_match_id,
    p_participant_a_id,
    p_participant_b_id,
    p_winner_id,
    p_participant_a_pokemon_defeated,
    p_participant_b_pokemon_defeated,
    p_played_at,
    p_notes
  );
$function$;

revoke all on function public.admin_save_typeleague_match(
  uuid, uuid, uuid, uuid, integer, integer, timestamptz, text
) from public, anon;
grant execute on function public.admin_save_typeleague_match(
  uuid, uuid, uuid, uuid, integer, integer, timestamptz, text
) to authenticated;

create or replace function app_private.admin_delete_typeleague_match_core(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_admin();

  if p_match_id is null then
    raise exception 'Selecciona un enfrentamiento válido.' using errcode = '22023';
  end if;

  delete from public.typeleague_matches where id = p_match_id;
  if not found then
    raise exception 'No encontramos el enfrentamiento que quieres eliminar.' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object('success', true, 'deleted_match_id', p_match_id);
end;
$function$;

revoke all on function app_private.admin_delete_typeleague_match_core(uuid) from public, anon;
grant execute on function app_private.admin_delete_typeleague_match_core(uuid) to authenticated;

create or replace function public.admin_delete_typeleague_match(p_match_id uuid)
returns jsonb
language sql
set search_path = ''
as $function$
  select app_private.admin_delete_typeleague_match_core(p_match_id);
$function$;

revoke all on function public.admin_delete_typeleague_match(uuid) from public, anon;
grant execute on function public.admin_delete_typeleague_match(uuid) to authenticated;

create or replace function app_private.admin_set_typeleague_visibility_core(p_visible boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_admin();

  if p_visible is null then
    raise exception 'Indica si TypeLeague debe estar visible.' using errcode = '22023';
  end if;

  update public.event_settings
  set typeleague_visible = p_visible,
      updated_at = pg_catalog.now()
  where singleton = true;

  if not found then
    raise exception 'No encontramos la configuración del evento.' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object('success', true, 'visible', p_visible);
end;
$function$;

revoke all on function app_private.admin_set_typeleague_visibility_core(boolean) from public, anon;
grant execute on function app_private.admin_set_typeleague_visibility_core(boolean) to authenticated;

create or replace function public.admin_set_typeleague_visibility(p_visible boolean)
returns jsonb
language sql
set search_path = ''
as $function$
  select app_private.admin_set_typeleague_visibility_core(p_visible);
$function$;

revoke all on function public.admin_set_typeleague_visibility(boolean) from public, anon;
grant execute on function public.admin_set_typeleague_visibility(boolean) to authenticated;

do $block$
begin
  if exists(select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.typeleague_matches;
    exception
      when duplicate_object then null;
    end;
  end if;
end;
$block$;
