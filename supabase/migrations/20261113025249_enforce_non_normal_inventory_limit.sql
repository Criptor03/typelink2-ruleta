-- Tramo and Fiesta cards never use a normal deck slot.
alter table public.card_catalog
  drop constraint if exists card_catalog_non_normal_slot_check;
alter table public.card_catalog
  add constraint card_catalog_non_normal_slot_check
  check (category = 'normal' or counts_toward_normal_limit = false);
