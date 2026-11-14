alter table public.player_type_status
  drop constraint if exists player_type_status_type_slug_check;

delete from public.player_type_status
where type_slug = 'hada';

alter table public.player_type_status
  add constraint player_type_status_type_slug_check
  check (type_slug in (
    'normal','fuego','agua','electrico','planta','hielo',
    'lucha','veneno','tierra','volador','psiquico','bicho',
    'roca','fantasma','dragon','siniestro','acero'
  ));

create or replace function app_private.seed_player_pokemon_types()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.player_type_status (owner_id, type_slug, is_enabled)
  values
    (new.id, 'normal', true),
    (new.id, 'fuego', true),
    (new.id, 'agua', true),
    (new.id, 'electrico', true),
    (new.id, 'planta', true),
    (new.id, 'hielo', true),
    (new.id, 'lucha', true),
    (new.id, 'veneno', true),
    (new.id, 'tierra', true),
    (new.id, 'volador', true),
    (new.id, 'psiquico', true),
    (new.id, 'bicho', true),
    (new.id, 'roca', true),
    (new.id, 'fantasma', true),
    (new.id, 'dragon', true),
    (new.id, 'siniestro', true),
    (new.id, 'acero', true)
  on conflict (owner_id, type_slug) do nothing;

  return new;
end;
$function$;
