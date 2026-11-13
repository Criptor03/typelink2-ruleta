-- Keep existing card actions available when a catalog entry is retired.
drop policy if exists "Signed-in users can view active card effects" on public.card_effects;
create policy "Signed-in users can view active or owned card effects"
on public.card_effects
for select
to authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.card_catalog cc
    where cc.id = card_effects.card_id
      and (
        cc.is_active = true
        or exists (
          select 1
          from public.player_cards pc
          where pc.card_id = cc.id
        )
      )
  )
);
