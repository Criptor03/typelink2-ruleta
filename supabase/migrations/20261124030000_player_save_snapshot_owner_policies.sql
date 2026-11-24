-- TypeLink Sync: grant table privileges to authenticated users.
-- RLS policies remain the authorization boundary; these grants only allow
-- the authenticated role to reach the table.

grant select, insert, update, delete on table public.player_save_snapshots to authenticated;

alter table public.player_save_snapshots enable row level security;

drop policy if exists "Players can insert own Pokémon snapshot" on public.player_save_snapshots;
create policy "Players can insert own Pokémon snapshot"
  on public.player_save_snapshots
  for insert
  to authenticated
  with check ((select auth.uid()) = player_id);

drop policy if exists "Players can update own Pokémon snapshot" on public.player_save_snapshots;
create policy "Players can update own Pokémon snapshot"
  on public.player_save_snapshots
  for update
  to authenticated
  using ((select auth.uid()) = player_id)
  with check ((select auth.uid()) = player_id);

drop policy if exists "Players can delete own Pokémon snapshot" on public.player_save_snapshots;
create policy "Players can delete own Pokémon snapshot"
  on public.player_save_snapshots
  for delete
  to authenticated
  using ((select auth.uid()) = player_id);

drop policy if exists "Signed-in users can view Pokémon snapshots" on public.player_save_snapshots;
create policy "Signed-in users can view Pokémon snapshots"
  on public.player_save_snapshots
  for select
  to authenticated
  using (true);
