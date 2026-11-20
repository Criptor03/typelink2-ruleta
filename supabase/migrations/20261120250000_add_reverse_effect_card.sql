-- TypeLink 2: Revierte Efecto
-- Reverses an active incoming player effect back to the trainer who originally
-- played the source card, consumes Revierte Efecto, and protects that card
-- from the existing deck-removal mechanics.

create or replace function public.get_trainer_reversible_cards(p_trainer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_tramo_started_at timestamptz;
  v_cards jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para consultar cartas reversibles.' using errcode = '28000';
  end if;
  if p_trainer_id is null or p_trainer_id <> v_user then
    raise exception 'Solo puedes consultar tus propias cartas reversibles.' using errcode = '42501';
  end if;

  select greatest(
    coalesce((select max(ca.created_at) from public.card_activity ca
      where ca.actor_id = p_trainer_id and ca.activity_type = 'tramo_award'), '-infinity'::timestamptz),
    coalesce((select max(ca.created_at) from public.card_activity ca
      where ca.target_id = p_trainer_id and ca.activity_type = 'tramo_adjustment'), '-infinity'::timestamptz),
    p.created_at
  )
  into v_tramo_started_at
  from public.profiles p
  where p.id = p_trainer_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'activity_id', ca.id,
        'card_instance_id', ca.card_instance_id,
        'card_name', coalesce(nullif(ca.details ->> 'card_name',''), cc.name, 'Carta TypeLink'),
        'card_slug', coalesce(ca.details ->> 'card_slug', cc.slug),
        'image_path', coalesce(nullif(ca.details ->> 'image_path',''), cc.image_path),
        'rarity', coalesce(nullif(ca.details ->> 'rarity',''), cc.rarity, 'card'),
        'category', coalesce(nullif(ca.details ->> 'category',''), cc.category, 'normal'),
        'sender_id', ca.actor_id,
        'sender_name', coalesce(sender.display_name, 'Entrenador'),
        'created_at', ca.created_at,
        'active_effects', count(pe.id)
      )
      order by ca.created_at desc, ca.id desc
    ),
    '[]'::jsonb
  )
  into v_cards
  from public.card_activity ca
  left join public.profiles sender on sender.id = ca.actor_id
  left join public.player_cards pc on pc.id = ca.card_instance_id
  left join public.card_catalog cc on cc.id = pc.card_id
  join public.player_effects pe
    on pe.owner_id = p_trainer_id
   and pe.source_card_instance_id = ca.card_instance_id
   and pe.status = 'active'
  where ca.target_id = p_trainer_id
    and ca.actor_id is distinct from p_trainer_id
    and ca.activity_type = 'play'
    and ca.created_at > v_tramo_started_at
    and coalesce(ca.details ->> 'card_slug', cc.slug) <> 'revierte-efecto'
  group by ca.id, ca.card_instance_id, ca.details, cc.name, cc.slug, cc.image_path,
           cc.rarity, cc.category, sender.display_name, ca.actor_id, ca.created_at;

  return v_cards;
end;
$function$;

revoke all on function public.get_trainer_reversible_cards(uuid) from public, anon;
grant execute on function public.get_trainer_reversible_cards(uuid) to authenticated;

do $patch$
declare
  v_definition text;
  v_marker text := '    if v_effect.effect_key = ''swap_full_deck'' then';
  v_block text := $block$
    if v_effect.effect_key = 'reverse_effect' then
      if v_card.target_scope <> 'self' or v_card.disposition <> 'consume' then
        raise exception 'La carta Revierte Efecto no tiene una configuración válida.' using errcode = '22023';
      end if;
      if p_target_id is null then
        raise exception 'Selecciona una carta que te hayan lanzado para devolverla al rival.' using errcode = '22023';
      end if;

      select ca.id as activity_id, ca.actor_id, ca.card_instance_id,
             cc.id as card_id, cc.name, cc.slug, cc.rarity, cc.category
      into v_selected_activity
      from public.card_activity ca
      join public.player_cards pc on pc.id = ca.card_instance_id
      join public.card_catalog cc on cc.id = pc.card_id
      where ca.id = p_target_id
        and ca.target_id = v_user
        and ca.actor_id is distinct from v_user
        and ca.activity_type = 'play';

      if not found then
        raise exception 'La carta seleccionada no es una carta que te hayan lanzado.' using errcode = '22023';
      end if;
      if v_selected_activity.slug = 'revierte-efecto' then
        raise exception 'No puedes revertir otra carta Revierte Efecto.' using errcode = '22023';
      end if;
      if not exists (
        select 1 from public.player_effects pe
        where pe.owner_id = v_user
          and pe.source_card_instance_id = v_selected_activity.card_instance_id
          and pe.status = 'active'
      ) then
        raise exception 'La carta seleccionada ya no tiene un efecto activo que puedas revertir.' using errcode = '22023';
      end if;

      update public.player_effects
      set owner_id = v_selected_activity.actor_id,
          applied_by = v_user,
          status = 'active',
          starts_at = pg_catalog.now()
      where owner_id = v_user
        and source_card_instance_id = v_selected_activity.card_instance_id
        and status = 'active';

      get diagnostics v_protected_effects = row_count;

      insert into public.card_activity(actor_id, target_id, card_instance_id, activity_type, details)
      values(v_user, v_selected_activity.actor_id, v_card.instance_id, 'effect_applied',
        pg_catalog.jsonb_build_object(
          'card_slug', v_card.slug, 'card_name', v_card.name,
          'effect_key', v_effect.effect_key,
          'reversed_card_name', v_selected_activity.name,
          'reversed_card_slug', v_selected_activity.slug,
          'reversed_card_instance_id', v_selected_activity.card_instance_id,
          'reversed_activity_id', v_selected_activity.activity_id,
          'reversed_effects', v_protected_effects,
          'image_path', v_card.image_path));

      insert into public.card_activity(actor_id, target_id, card_instance_id, activity_type, details)
      values(v_user, v_user, v_card.instance_id, 'play',
        pg_catalog.jsonb_build_object(
          'card_slug', v_card.slug, 'card_name', v_card.name,
          'rarity', v_card.rarity, 'category', v_card.category,
          'image_path', v_card.image_path, 'target_scope', v_card.target_scope,
          'disposition', v_card.disposition, 'effect_count', 1,
          'unlock_count', 0, 'manipulation_action', 'reverse'));

      update public.player_cards
      set status = 'used', remaining_uses = 0
      where id = v_card.instance_id;

      insert into public.card_activity(actor_id, target_id, card_instance_id, activity_type, details)
      values(v_user, v_user, v_card.instance_id, 'consume',
        pg_catalog.jsonb_build_object(
          'card_slug', v_card.slug, 'card_name', v_card.name,
          'image_path', v_card.image_path));

      v_applied_count := v_applied_count + 1;
      v_effects := v_effects || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'effect_key', v_effect.effect_key, 'operation', v_effect.operation,
          'reversed_card_name', v_selected_activity.name,
          'reversed_effects', v_protected_effects));

      return pg_catalog.jsonb_build_object(
        'success', true, 'action', 'play',
        'card_instance_id', v_card.instance_id, 'card_id', v_card.card_id,
        'slug', v_card.slug, 'name', v_card.name, 'rarity', v_card.rarity,
        'category', v_card.category, 'description', v_card.description,
        'image_path', v_card.image_path, 'target_scope', v_card.target_scope,
        'disposition', v_card.disposition, 'status', 'used',
        'remaining_uses', 0, 'target_id', v_selected_activity.actor_id,
        'effects_applied', v_effects, 'roulette_unlocks', v_unlocks,
        'protection', false, 'manipulation_action', 'reverse',
        'result_name', v_selected_activity.name);
    end if;

$block$;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure)
    into v_definition;

  v_definition := replace(
    v_definition,
    'CREATE OR REPLACE FUNCTION app_private.play_card_core(p_card_instance_id uuid, p_target_id uuid DEFAULT NULL::uuid)',
    'CREATE OR REPLACE FUNCTION app_private.play_card_core(p_card_instance_id uuid, p_target_id uuid DEFAULT NULL::uuid, p_manipulation_card_id uuid DEFAULT NULL::uuid)'
  );

  if position('reverse_effect' in v_definition) = 0 then
    v_definition := replace(v_definition, v_marker, v_block || v_marker);
  end if;

  v_definition := replace(v_definition,
    'and cc.rarity <> ''legendary''',
    'and cc.rarity <> ''legendary'' and cc.slug <> ''revierte-efecto''');
  v_definition := replace(v_definition,
    'and cc.category <> ''fiesta'';',
    'and cc.category <> ''fiesta'' and cc.slug <> ''revierte-efecto''');

  execute v_definition;
end;
$patch$;

create or replace function app_private.play_card_core(
  p_card_instance_id uuid,
  p_target_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select app_private.play_card_core(p_card_instance_id, p_target_id, null::uuid);
$function$;

do $patch$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.admin_save_card_mechanics_core(uuid,text,text,jsonb,jsonb)'::regprocedure
  ) into v_definition;

  if position('reverse_effect' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '    elsif v_key in (''copy_opponent_card'', ''copy_incoming_card'', ''steal_opponent_card'', ''transform_card'') then',
      '    elsif v_key in (''copy_opponent_card'', ''copy_incoming_card'', ''steal_opponent_card'', ''transform_card'', ''reverse_effect'') then');

    v_definition := replace(
      v_definition,
      '      if v_key = ''transform_card'' then',
      '      if v_key = ''reverse_effect'' then
        v_operation := ''grant'';
        if p_disposition <> ''consume'' then raise exception ''Revertir un efecto requiere consumir la carta utilizada.'' using errcode = ''22023''; end if;
      elsif v_key = ''transform_card'' then');

    execute v_definition;
  end if;
end;
$patch$;

insert into public.card_effects(
  card_id,effect_key,operation,effect_value,parameters,
  duration_type,duration_value,duration_unit,sort_order,is_active
)
select id,'reverse_effect','grant',null,'{}'::jsonb,'instant',null,'hours',0,true
from public.card_catalog
where slug = 'revierte-efecto'
and not exists(
  select 1 from public.card_effects ce
  where ce.card_id = public.card_catalog.id
    and ce.effect_key = 'reverse_effect'
);
