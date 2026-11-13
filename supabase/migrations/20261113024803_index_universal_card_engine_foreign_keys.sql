-- Supporting indexes for foreign keys in the TypeLink 2 card engine.
create index if not exists card_activity_card_instance_idx
  on public.card_activity(card_instance_id);
create index if not exists card_evolution_ingredients_card_idx
  on public.card_evolution_ingredients(card_id);
create index if not exists card_evolution_rules_result_card_idx
  on public.card_evolution_rules(result_card_id);
create index if not exists player_effects_applied_by_idx
  on public.player_effects(applied_by);
create index if not exists player_effects_source_card_idx
  on public.player_effects(source_card_instance_id);
create index if not exists player_roulette_unlocks_pool_idx
  on public.player_roulette_unlocks(pool_id);
create index if not exists player_roulette_unlocks_source_card_idx
  on public.player_roulette_unlocks(source_card_instance_id);
create index if not exists roulette_pool_cards_card_idx
  on public.roulette_pool_cards(card_id);
