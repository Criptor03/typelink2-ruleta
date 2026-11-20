-- Fix incoming-card copy to use the card recorded when it was thrown,
-- and only allow cards thrown during the user's current tramo.

do $patch$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('app_private.play_card_core(uuid,uuid)'::regprocedure) into v_definition;

  if position('ca.details ->> ''card_slug''' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '        select ca.id, ca.actor_id, ca.card_instance_id, cc.id as card_id, cc.name, cc.slug, cc.rarity, cc.category, cc.image_path, cc.uses_per_card into v_selected_activity'||E'\n'||
      '        from public.card_activity ca join public.player_cards pc on pc.id = ca.card_instance_id join public.card_catalog cc on cc.id = pc.card_id'||E'\n'||
      '        where ca.id = p_target_id and ca.target_id = v_user and ca.actor_id is distinct from v_user and ca.activity_type = ''play'';',
      '        select ca.id, ca.actor_id, ca.card_instance_id, cc.id as card_id, cc.name, cc.slug, cc.rarity, cc.category, cc.image_path, cc.uses_per_card into v_selected_activity'||E'\n'||
      '        from public.card_activity ca join public.card_catalog cc on cc.slug = ca.details ->> ''card_slug'''||E'\n'||
      '        where ca.id = p_target_id and ca.target_id = v_user and ca.actor_id is distinct from v_user and ca.activity_type = ''play'' and ca.created_at > coalesce((select max(award.created_at) from public.card_activity award where award.actor_id = v_user and award.activity_type = ''tramo_award''), (select p.created_at from public.profiles p where p.id = v_user));'
    );
    execute v_definition;
  end if;
end;
$patch$;