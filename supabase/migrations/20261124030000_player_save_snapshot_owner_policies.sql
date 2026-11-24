-- Allow each authenticated trainer to replace only their own Pokémon save snapshot.
create policy "Players can insert own Pokémon snapshot"
on public.player_save_snapshots
for insert
to authenticated
with check ((select auth.uid()) = player_id);

create policy "Players can update own Pokémon snapshot"
on public.player_save_snapshots
for update
to authenticated
using ((select auth.uid()) = player_id)
with check ((select auth.uid()) = player_id);

create policy "Players can delete own Pokémon snapshot"
on public.player_save_snapshots
for delete
to authenticated
using ((select auth.uid()) = player_id);
