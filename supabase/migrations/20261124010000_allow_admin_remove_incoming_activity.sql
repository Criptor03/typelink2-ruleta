-- Allow the admin audit event used when removing an incoming card.
-- The removal function already exists; this migration only fixes the activity type constraint.

alter table public.card_activity
  drop constraint if exists card_activity_activity_type_check;

alter table public.card_activity
  add constraint card_activity_activity_type_check
  check (
    activity_type = any (array[
      'card_draw',
      'tramo_award',
      'play',
      'transfer',
      'consume',
      'evolution',
      'roulette_unlock',
      'roulette_spin',
      'effect_applied',
      'effect_expired',
      'admin_grant',
      'admin_remove',
      'admin_remove_incoming',
      'tramo_adjustment'
    ]::text[])
  );
