do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.admin_save_card_mechanics_core(uuid,text,text,jsonb,jsonb)'::regprocedure
  ) into v_definition;
  v_old := $old$
  if v_evolution_enabled then
    update public.card_catalog set roulette_eligible = false where id = p_card_id;
    delete from public.roulette_pool_cards where card_id = p_card_id;
  end if;
$old$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró la exclusión automática de ruletas en admin_save_card_mechanics_core.';
  end if;
  v_definition := pg_catalog.replace(
    v_definition,v_old,
    E'  -- Evolution rules do not change roulette eligibility or pool membership.\n'
  );
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'app_private.admin_save_card_core(jsonb)'::regprocedure
  ) into v_definition;
  v_old := $old$
  if v_roulette_eligible and v_id is not null and exists (
    select 1 from public.card_evolution_rules er
    where er.source_card_id = v_id and er.is_active = true
  ) then
    raise exception 'Esta carta tiene una evolución activa y no puede aparecer en la ruleta.' using errcode = '22023';
  end if;
$old$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el bloqueo de edición de cartas con evolución.';
  end if;
  v_definition := pg_catalog.replace(
    v_definition,v_old,
    E'  -- Cards with an active evolution may still be included in roulettes.\n'
  );
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'app_private.admin_list_roulette_pools_core()'::regprocedure
  ) into v_definition;
  v_old := $old$
            and not exists (
              select 1 from public.card_evolution_rules er
              where er.source_card_id = cc.id and er.is_active = true
            )
$old$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el filtro de evoluciones en admin_list_roulette_pools_core.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,E'\n');
  if pg_catalog.strpos(v_definition,v_old) > 0 then
    raise exception 'Quedó un filtro de evolución sin retirar en admin_list_roulette_pools_core.';
  end if;
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'app_private.admin_save_roulette_pool_core(text,boolean,text,jsonb)'::regprocedure
  ) into v_definition;
  v_old := $old$
    if not v_card.roulette_eligible or exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = v_card.id and er.is_active = true
    ) then
      raise exception 'La carta «%» está excluida de las ruletas o tiene una evolución activa.', v_card.name using errcode = '22023';
    end if;
$old$;
  v_new := $new$
    if not v_card.roulette_eligible then
      raise exception 'La carta «%» está excluida de las ruletas. Actívala en el catálogo antes de incluirla.', v_card.name using errcode = '22023';
    end if;
$new$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el bloqueo de guardado de cartas con evolución en las ruletas.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,v_new);
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'public.get_active_roulette_cards(text)'::regprocedure
  ) into v_definition;
  v_old := $old$
    and not exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = cc.id and er.is_active = true
    )
$old$;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el filtro de evoluciones en get_active_roulette_cards.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,E'\n');
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'app_private.draw_normal_card_with_tramo_credit_core()'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el filtro de evoluciones en la ruleta normal.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,E'\n');
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'app_private.draw_special_roulette_card_core(text)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition,v_old) = 0 then
    raise exception 'No se encontró el filtro de evoluciones en las ruletas especiales.';
  end if;
  v_definition := pg_catalog.replace(v_definition,v_old,E'\n');
  execute v_definition;

  update public.card_catalog c
  set roulette_eligible = true
  where c.is_active = true
    and c.category in ('normal','fiesta')
    and exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = c.id and er.is_active = true
    );

  insert into public.roulette_pool_cards(pool_id,card_id,weight,is_active)
  select rp.id,c.id,1,c.is_active
  from public.card_catalog c
  join public.roulette_pools rp on
    (rp.slug='normal' and c.category='normal' and c.rarity<>'legendary')
    or (rp.slug='legendary' and c.category='normal' and c.rarity='legendary')
    or (rp.slug='fiesta' and c.category='fiesta')
  where c.is_active = true
    and c.roulette_eligible = true
    and exists (
      select 1 from public.card_evolution_rules er
      where er.source_card_id = c.id and er.is_active = true
    )
  on conflict (pool_id,card_id) do nothing;
end;
$migration$;
