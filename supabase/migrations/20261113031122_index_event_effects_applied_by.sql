-- Index the foreign key used to identify who applied event-wide effects.
create index if not exists event_effects_applied_by_idx
  on public.event_effects(applied_by);
