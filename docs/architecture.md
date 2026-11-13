# TypeLink 2 — Backend architecture

## Supabase project

- Project: `typelink2-platform`
- Project ref: `zguoojvapbhgalbcvhgn`
- Project URL: `https://zguoojvapbhgalbcvhgn.supabase.co`
- Current region: `us-west-2` (US West). This differs from the originally preferred São Paulo region; keep in mind before production data is added.
- Plan at creation: Free; the quoted project cost was USD $0/month.

## Current database foundation

The following tables are provisioned in the `public` schema:

- `profiles`: public trainer profile linked one-to-one with `auth.users`. A database trigger creates the profile when an Auth user signs up. Users can update only their own display name and avatar.
- `card_catalog`: definitions of normal and tramo cards. Catalog rows are not active by default.
- `player_cards`: individual card instances owned by players. Duplicate copies are allowed. Client-side writes are not granted; awards and changes must go through trusted server-side logic.
- `player_save_snapshots`: current parsed save summary, including trainer data, party, boxes, and bag. Client-side writes are not granted; a verified importer will update it.
- `notifications`: private notifications; recipients can read their own notifications and mark them as read.
- `event_settings`: singleton event configuration. Defaults: current tramo 0, normal card limit 5, and 2 cards per tramo.

## Security

- Row Level Security is enabled on all six public tables.
- Security policies allow authenticated participants to view profiles, active card definitions, public player inventories, public Pokémon snapshots, and event settings.
- Notifications are restricted to their recipient.
- Player inventories and Pokémon snapshots cannot be written directly from an untrusted browser client.
- The public `rls_auto_enable()` function has had execute privileges revoked from `PUBLIC`, `anon`, and `authenticated`.
- No Supabase secret/service-role key may be placed in this public GitHub repository or browser code. Only a publishable key may be used by the frontend, together with RLS.

## Realtime

The following tables are included in the `supabase_realtime` publication:

- `player_cards`
- `player_save_snapshots`
- `notifications`

Row Level Security remains the access control boundary for realtime subscribers.

## Discord OAuth — setup still required

1. Create a Discord application in the Discord Developer Portal.
2. Add this Supabase callback URL under OAuth2 Redirects:
   `https://zguoojvapbhgalbcvhgn.supabase.co/auth/v1/callback`
3. Copy its Client ID and Client Secret.
4. Enter those credentials in Supabase Dashboard → Authentication → Sign In / Providers → Discord. Do not commit the Client Secret to GitHub.
5. Configure the Supabase Auth Site URL and allowed redirect URL to:
   `https://criptor03.github.io/typelink2-ruleta/`

## Not implemented yet

- Discord OAuth credentials and frontend login flow.
- Server-side roulette award logic enforcing the 5-card normal limit.
- Admin authorization and tramo issuance.
- Verified Pokémon Black/White DeSmuME save parser.
- Browser-assisted .dsv monitoring and synchronization client.
