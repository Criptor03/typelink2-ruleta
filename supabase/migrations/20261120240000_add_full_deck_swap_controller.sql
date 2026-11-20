-- TypeLink 2: add the full-deck swap controller to the 3-argument play_card_core path.
-- The card-use modal calls play_card_with_message, which routes through this overload.
do $patch$
declare
  v_definition text;
  v_marker text := '    if v_effect.effect_key = ''steal_full_deck'' then';
  v_block text := $block$
    if v_effect.effect_key = 'swap_full_deck' then
      if v_card.target_scope <> 'opponent' or v_card.disposition <> 'consume' then
        raise exception 'La carta para intercambiar toda la baraja no tiene una configuración válida.' using errcode = '22023';
      end if;
      if v_target_id is null or v_target_id = v_user then
        raise exception 'Debes elegir a otro entrenador para intercambiar las barajas.' using errcode = '22023';
      end if;
      if coalesce((select tp.current_tramo
                   from public.player_tramo_progress tp
                   where tp.owner_id = v_target_id), 0) >= 12 then
        raise exception 'No puedes lanzar cartas contra un entrenador que ya es campeón.' using errcode = '22023';
      end if;

      -- The card being played remains with its owner until the normal consume step.
      -- Every other available card is exchanged between both trainers.
      update public.player_cards
      set owner_id = case
        when owner_id = v_user then v_target_id
        when owner_id = v_target_id then v_user
        else owner_id
      end
      where owner_id in (v_user, v_target_id)
        and status = 'available'
        and id <> v_card.instance_id;

      get diagnostics v_effect_count = row_count;

      insert into public.card_activity(
        actor_id, target_id, card_instance_id, activity_type, details
      )
      values(
        v_user, v_target_id, v_card.instance_id, 'effect_applied',
        pg_catalog.jsonb_build_object(
          'card_slug', v_card.slug,
          'card_name', v_card.name,
          'effect_key', v_effect.effect_key,
          'swapped_cards_count', v_effect_count,
          'image_path', v_card.image_path
        )
      );

      v_applied_count := v_applied_count + 1;
      v_effects := v_effects || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'effect_key', v_effect.effect_key,
          'operation', v_effect.operation,
          'swapped_cards_count', v_effect_count
        )
      );
      continue;
    end if;

$block$;
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.play_card_core(uuid,uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('swap_full_deck' in v_definition) = 0 then
    v_definition := replace(v_definition, v_marker, v_block || v_marker);
    execute v_definition;
  end if;
end;
$patch$;
