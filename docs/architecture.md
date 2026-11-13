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
- `card_catalog`: eight active provisional card definitions (six normal and two tramo). These are placeholders awaiting the approved final TypeLink 2 catalogue.
- `player_cards`: individual card instances owned by players. Duplicates are allowed. Authenticated participants can read public inventories; clients cannot insert/update/delete inventory rows directly.
- `player_save_snapshots`: parsed Pokémon trainer data, party, boxes, and bag. Public to authenticated participants; only a trusted importer/server should write snapshots.
- `notifications`: private notifications; recipients can read their own and mark them as read.
- `event_settings`: singleton configuration. Defaults: current tramo 0, normal-card limit 5, and 2 cards per tramo.

## Card-award functions

- `public.draw_random_card()`: SECURITY DEFINER RPC callable only by authenticated users. It checks `auth.uid()`, takes a per-user transaction advisory lock, checks the five-card normal limit, selects an active normal card, and inserts the reward in the same transaction.
- `public.issue_tramo_cards()`: SECURITY DEFINER RPC callable only by authenticated users. It takes the same per-user lock and inserts two active tramo cards with a per-player tramo number. Tramo cards do not count toward the normal-card limit.
- Both functions revoke EXECUTE from `PUBLIC` and `anon`; EXECUTE is granted only to `authenticated`. The Supabase security advisor flags authenticated-callable SECURITY DEFINER functions as a generic warning. In this case this is intentional: they are the trusted award boundary, validate the caller using `auth.uid()`, use a fixed empty search path and qualified table names, and do not accept a caller-supplied player ID or card ID. Review their definitions before changing grants.

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
- Sending/applying cards to another participant and related notifications.
- Admin authorization and staff-only controls.
- Final approved card art and descriptions.
- Production moderation, rate limiting and event-operational safeguards.