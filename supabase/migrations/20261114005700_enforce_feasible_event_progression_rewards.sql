alter table public.event_settings
  add constraint event_settings_spins_within_deck_limit_check
  check (normal_spins_per_tramo <= normal_card_limit);

create or replace function app_private.admin_save_event_progression_settings_core(
  p_normal_card_limit integer,
  p_cards_per_tramo integer,
  p_normal_spins_per_tramo integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_active_tramo_cards integer;
begin
  perform app_private.require_admin();

  if p_normal_card_limit is null or p_normal_card_limit < 1 or p_normal_card_limit > 20 then
    raise exception 'El límite de cartas normales debe estar entre 1 y 20.'
      using errcode = '22023';
  end if;

  if p_cards_per_tramo is null or p_cards_per_tramo < 1 or p_cards_per_tramo > 10 then
    raise exception 'Las cartas entregadas por tramo deben estar entre 1 y 10.'
      using errcode = '22023';
  end if;

  if p_normal_spins_per_tramo is null or p_normal_spins_per_tramo < 1 or p_normal_spins_per_tramo > 20 then
    raise exception 'Los giros normales entregados por tramo deben estar entre 1 y 20.'
      using errcode = '22023';
  end if;

  if p_normal_spins_per_tramo > p_normal_card_limit then
    raise exception 'No puedes entregar más giros por tramo que espacios base de baraja. Reduce los giros o aumenta el límite de cartas.'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_active_tramo_cards
  from public.card_catalog cc
  where cc.category = 'tramo'
    and cc.is_active = true;

  if v_active_tramo_cards < p_cards_per_tramo then
    raise exception 'Solo hay % cartas de tramo activas. Activa o crea más cartas antes de configurar una entrega de %.',
      v_active_tramo_cards, p_cards_per_tramo
      using errcode = '22023';
  end if;

  update public.event_settings es
  set normal_card_limit = p_normal_card_limit,
      cards_per_tramo = p_cards_per_tramo,
      normal_spins_per_tramo = p_normal_spins_per_tramo,
      updated_at = pg_catalog.now()
  where es.singleton = true;

  if not found then
    raise exception 'No existe la configuración principal del evento.'
      using errcode = 'P0002';
  end if;

  return app_private.admin_get_event_progression_settings_core();
end;
$function$;

revoke all on function app_private.admin_save_event_progression_settings_core(integer, integer, integer) from public, anon;
grant execute on function app_private.admin_save_event_progression_settings_core(integer, integer, integer) to authenticated;
