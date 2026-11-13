alter table public.player_cards
  drop constraint if exists player_cards_tramo_number_check;

alter table public.player_cards
  add constraint player_cards_tramo_number_check
  check (
    (source = 'tramo' and tramo_number is not null and tramo_number > 0)
    or
    (source <> 'tramo' and (tramo_number is null or tramo_number >= 0))
  );

do $patch$
declare
  v_draw text;
  v_grant text;
  v_old_draw text := E'  insert into public.player_cards (owner_id, card_id, source, remaining_uses)\n  values (v_user, v_card.id, ''roulette'', v_card.uses_per_card)';
  v_new_draw text := E'  insert into public.player_cards (owner_id, card_id, source, tramo_number, remaining_uses)\n  values (v_user, v_card.id, ''roulette'', v_progress.current_tramo, v_card.uses_per_card)';
  v_old_grant text := E'    p_player_id, v_card.id, ''admin'', null, ''available'', v_card.uses_per_card';
  v_new_grant text := E'    p_player_id, v_card.id, ''admin'', v_tramo, ''available'', v_card.uses_per_card';
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.draw_normal_card_with_tramo_credit_core()'::regprocedure
  ) into v_draw;
  if strpos(v_draw,v_old_draw)=0 then
    raise exception 'Could not locate normal roulette inventory insert.';
  end if;
  execute pg_catalog.replace(v_draw,v_old_draw,v_new_draw);

  select pg_catalog.pg_get_functiondef(
    'app_private.admin_grant_trainer_card_core(uuid,uuid,integer)'::regprocedure
  ) into v_grant;
  if strpos(v_grant,v_old_grant)=0 then
    raise exception 'Could not locate admin grant inventory insert.';
  end if;
  execute pg_catalog.replace(v_grant,v_old_grant,v_new_grant);
end;
$patch$;
