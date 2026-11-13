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
- `player_cards`: individual card instances owned by players. Duplicates are allowed. Authenticated participants can read public inventories; clients cannot insert/update/delete inventory rows directly.
- `card_effects`: one or more declarative effects attached to a card, with operation, parameters and duration.
- `player_effects`: active/past effects applied to a trainer. It records the source card, applying trainer, duration and expiration data. Active additive modifiers to `normal_card_limit` are summed by the server.
- `roulette_pools` and `roulette_pool_cards`: named roulette pools and their explicit card memberships/weights. The normal, legendary and Fiesta pools are created; membership is intentionally not populated until the approved catalogue is ready.
- `player_roulette_unlocks`: per-trainer access credits for a roulette pool, with spins granted, spins consumed and optional expiry. This supports special access cards such as the Legendary and Fiesta passes.
- `card_evolution_rules` and `card_evolution_ingredients`: recipes that list the required cards, quantities and resulting card. The future evolution RPC will consume the selected card instances atomically.
- `card_activity`: audit trail for draws, plays, transfers, consumption, evolutions, unlocks and effect changes.
- `player_save_snapshots`: parsed Pokémon trainer data, party, boxes, and bag. Public to authenticated participants; only a trusted importer/server should write snapshots.
- `notifications`: private notifications; recipients can read their own and mark them as read.
- `event_settings`: singleton configuration. Defaults: current tramo 0, normal-card limit 5, and 2 cards per tramo.

## Universal card-engine rules

- **Capacity modifiers add together.** The normal deck capacity is `event_settings.normal_card_limit + SUM(active player_effects.effect_value)` for the `normal_card_limit` key and `add` operation. Tramo-limited and timed expiration fields are checked by the backend.
- **Card disposition is per card.** `card_catalog.disposition` supports `consume`, `transfer`, and `retain`; `target_scope` supports self, opponent, either, all players, event-wide or no player target.
- **Evolution consumes its ingredients.** Recipe tables define the required card types and quantities; the future server RPC will mark the chosen ingredient instances as used and award the result in one transaction.
- **Roulette access is credit-based.** Special access cards create spin credits in `player_roulette_unlocks`. A credit records which pool it opens, how many spins it grants and how many have been spent. The initial Fiesta access card is intended to grant access to the Fiesta pool.
- **Effects are data, not executable code.** The database stores known effect keys, operations and JSON parameters. New effect behavior still needs a validated server-side handler; it is not safe to run arbitrary code stored in a card row.

## Card-award functions

- `public.draw_random_card()` and `public.issue_tramo_cards()` are SECURITY INVOKER RPC wrappers callable only by `authenticated`.
- Their privileged core logic lives in the non-Data-API `app_private` schema as SECURITY DEFINER functions. Those core functions validate `auth.uid()`, use a fixed empty search path and qualified table names, and do not accept caller-supplied player IDs or card IDs.
- `draw_random_card` takes a per-user transaction advisory lock and checks the effective normal-card capacity: the event base limit plus the sum of all active additive `normal_card_limit` effects. It then selects an active normal card and inserts the reward in the same transaction. The temporary +2 and +1 test returned a base of 5, bonus of 3 and effective limit of 8; the test transaction was rolled back.
- `issue_tramo_cards` takes the same lock and inserts two active tramo cards with a per-player tramo number. Tramo cards do not count toward the normal-card limit.
- EXECUTE is revoked from `PUBLIC` and `anon`; the public wrappers and their private core functions are executable only by `authenticated`.

## Security

- Row Level Security is enabled on all six public tables.
- Profiles, active card definitions, public player inventories, public Pokémon snapshots, and event settings are readable by authenticated event participants.
- Notifications are restricted to their recipient.
- Player inventory and Pokémon snapshot writes are not granted directly to browser clients.
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
- Atomic RPCs for playing, consuming, transferring and applying cards/effects.
- Pool-aware roulette draw RPCs, spin-credit redemption and the card-access workflow for the Legendary and Fiesta roulettes.
- Atomic evolution RPC that validates recipes and consumes the selected ingredient instances.
- Effect-expiration handling at tramo/match boundaries and an admin workflow for managing the pools/recipes.
- Admin authorization and staff-only controls.
- Final approved card art and descriptions.
- Production moderation, rate limiting and event-operational safeguards.

## Migration tracking

- `20261113024650_add_universal_card_engine`
- `20261113024803_index_universal_card_engine_foreign_keys`

The new engine is a database foundation only: the current Beta 0.3 interface still uses the existing standard roulette and does not yet expose card play, transfers, evolutions or special roulettes.
