create policy "Authenticated players can view public type status"
on public.player_type_status
for select
to authenticated
using (true);
