# TypeLink 2 — Backend architecture

## Active Supabase project

- Project: `typelink2-platform-saopaulo`
- Project ref: `uytdmfrynuzofkyedhve`
- Project URL: `https://uytdmfrynuzofkyedhve.supabase.co`
- Region: `sa-east-1` (South America, São Paulo)
- Plan at creation: Free; quoted project cost was USD $0/month.
- Status: ACTIVE_HEALTHY

The earlier project `typelink2-platform` in `us-west-2` is retained temporarily as an empty backup/reference. The frontend uses only the São Paulo project.

## Authentication

- Discord OAuth is configured in Supabase Auth.
- The public frontend uses `@supabase/supabase-js` and the project's publishable key.
- The app redirects to GitHub Pages after OAuth and persists the Auth session in the browser.
- A database trigger creates or refreshes a `profiles` row from the authenticated user's Discord metadata.
- Never commit the Discord Client Secret, Supabase secret key, or legacy service-role key.

## Database tables

- `profiles`: public trainer identity linked one-to-one with `auth.users`. The owner may update their display name and avatar; authenticated participants can view profiles.
- `card_catalog`: provisional card definitions. Its category now supports `normal`, `tramo`, and `fiesta`; rarity supports `common`, `rare`, `epic`, `legendary`, `tramo`, and `fiesta`. Each card can declare its target scope, whether it is consumed/transferred/retained after use, and whether it occupies a normal deck slot.
- `player_cards`: individual card instances owned by players. Duplicates are allowed. Each instance stores `remaining_uses`; a consumed use decreases the counter by one and the instance becomes `used` at zero. Authenticated participants can read public inventories; clients cannot insert/update/delete inventory rows directly.
- `card_effects`: one or more declarative effects attached to a card, with operation, parameters, duration and time unit.
- `player_effects`: active/past effects applied to a trainer. It records the source card, applying trainer, duration and expiration data. Active additive modifiers to `normal_card_limit` are summed by the server.
- `event_effects`: active/past effects attached to the whole event, such as event-wide or interface/roulette modifiers.
- `roulette_pools` and `roulette_pool_cards`: named roulette pools and their explicit card memberships/weights. The normal, legendary and Fiesta pools are created; membership is intentionally not populated until the approved catalogue is ready.
- `player_roulette_unlocks`: per-trainer access credits for a roulette pool, with spins granted, spins consumed and optional expiry. This supports special access cards such as the Legendary and Fiesta passes.
- `card_evolution_rules`: one source card ID and one result card ID. Evolutions never combine ingredients or merge two cards. `card_evolution_ingredients` is retained as an unused legacy table and is not consulted by the evolution engine.
- `card_activity`: audit trail for draws, plays, transfers, consumption, evolutions, unlocks and effect changes.
- `player_save_snapshots`: parsed Pokémon trainer data, party, boxes, and bag. Public to authenticated participants; only a trusted importer/server should write snapshots.
- `notifications`: private notifications; recipients can read their own and mark them as read.
- `event_settings`: singleton configuration. Defaults: current tramo 0, normal-card limit 5, and 2 cards per tramo.

## Universal card-engine rules

- **Capacity modifiers add together.** The normal deck capacity is `event_settings.normal_card_limit + SUM(active player_effects.effect_value)` for the `normal_card_limit` key and `add` operation. Tramo-limited and timed expiration fields are checked by the backend.
- **Card disposition is per card.** `card_catalog.disposition` supports `consume`, `transfer`, and `retain`; `target_scope` supports self, opponent, either, all players, event-wide or no player target. Tramo and Fiesta cards are constrained not to occupy normal deck slots; normal-category cards can be configured individually.
- **Evolution transforms one card into one card.** An active rule maps `source_card_id` to `result_card_id`. `evolve_card` consumes the source instance and creates a new result instance in one transaction; the new card receives its own configured `uses_per_card` value.
- **Roulette access is credit-based.** Special access cards create spin credits in `player_roulette_unlocks`. A credit records which pool it opens, how many spins it grants and how many have been spent. The initial Fiesta access card is intended to grant access to the Fiesta pool.
- **Effects are data, not executable code.** The database stores known effect keys, operations, JSON parameters and duration. Timed effects support seconds, minutes, hours or days. The first built-in handlers are `normal_card_limit` (additive capacity) and `unlock_roulette` (grant a spin credit). Other effect keys can be stored by the engine, but need their own validated game handler before they change gameplay.

## Card-award functions

- `public.draw_random_card()`, `public.issue_tramo_cards()`, `public.play_card(card_instance_id, target_id)` and `public.evolve_card(card_instance_id)` are SECURITY INVOKER RPC wrappers callable only by `authenticated`.
- Their privileged core logic lives in the non-Data-API `app_private` schema as SECURITY DEFINER functions. Those core functions validate `auth.uid()`, use a fixed empty search path and qualified table names, and do not accept caller-supplied player IDs or card IDs.
- `draw_random_card` takes a per-user transaction advisory lock and checks the effective normal-card capacity: the event base limit plus the sum of all active additive `normal_card_limit` effects. It counts only available cards, so a consumed card frees a deck slot. It then selects an active normal card and inserts the reward in the same transaction. The temporary +2 and +1 test returned a base of 5, bonus of 3 and effective limit of 8; the test transaction was rolled back.
- `play_card` validates card ownership, availability, target scope and disposition server-side. It supports self, opponent, either, all-player, event-wide and targetless use. It applies configured effects and records activity. A `consume` card spends exactly one use per successful play and becomes exhausted at zero; a `transfer` card moves to another trainer without activating its effect.
- `play_card` also supports an `unlock_roulette` grant effect for targetless access tickets. A card configured with `pool_slug` and `spins_granted` grants credits to the trainer and is consumed in the same transaction.
- `issue_tramo_cards` takes the same lock and inserts two active tramo cards with a per-player tramo number. Tramo cards do not count toward the normal-card limit.
- EXECUTE is revoked from `PUBLIC` and `anon`; the public wrappers and their private core functions are executable only by `authenticated`.

## Security

- Row Level Security is enabled on all fifteen tables in the exposed `public` schema.
- The new engine tables are read-only to authenticated browser clients; card effects, applied player/event effects, recipes, roulette definitions and the activity feed are readable according to their policies.
- Each trainer can read only their own roulette unlock credits.
- Player inventory, player effects, evolution recipes, roulette credits and activity records cannot be inserted or modified directly by browser clients; future card actions must go through validated server RPCs.
- Notifications remain restricted to their recipient.
- The `app_private` schema is not exposed through the Data API.
- The frontend key is a publishable key intended for browser use with RLS; no secret/service-role key belongs in the frontend.

## Realtime

The following tables are included in `supabase_realtime`:

- `profiles`
- `player_cards`
- `player_save_snapshots`
- `notifications`

Realtime subscribers remain subject to RLS. The frontend currently subscribes to the signed-in player's inventory and the public profile directory.

## Discord OAuth redirect

`https://uytdmfrynuzofkyedhve.supabase.co/auth/v1/callback`

Supabase Auth Site URL and allowed redirect URL:

`https://criptor03.github.io/typelink2-ruleta/`

## Not implemented yet

- Pokémon Black/White DeSmuME `.dsv` parser and browser-assisted save monitoring.
- Pool-aware roulette draw RPCs and spin-credit redemption for Legendary and Fiesta roulettes.
- Charge-based card use (`uses_per_card` and `remaining_uses`) and single-card evolution (`source_card_id` to `result_card_id`) are implemented and transaction-tested.
- Decremento de efectos por cargas, expiración automática al finalizar partidos y un panel de administración para gestionar cartas, efectos, pools y recetas.
- Admin authorization and staff-only controls.
- Final approved card art and descriptions.
- Production moderation, rate limiting and event-operational safeguards.

## Migration tracking

- `20261113024650_add_universal_card_engine`
- `20261113024803_index_universal_card_engine_foreign_keys`
- `20261113025249_enforce_non_normal_inventory_limit`
- `20261113030738_add_play_card_runtime`
- `20261113030931_add_card_effect_duration_constraints`
- `20261113031122_index_event_effects_applied_by`
- `20261113033628_add_card_use_counts_and_single_card_evolution`

The server-side `play_card` and `evolve_card` runtimes are implemented and transaction-tested. The Beta 0.3 baraja now exposes use/transfer actions, remaining-use counters and a one-card evolution dialog when a rule is configured. Card art remains attached through each catalog row's `image_path`; evolved results return their own image path. Special roulette draws are still pending.
