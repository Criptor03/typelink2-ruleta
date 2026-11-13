-- Add validation for duration-dependent card effects.
alter table public.card_effects
  drop constraint if exists card_effects_normal_limit_duration_check,
  drop constraint if exists card_effects_timed_duration_check;
alter table public.card_effects
  add constraint card_effects_normal_limit_duration_check
    check (effect_key <> 'normal_card_limit'
      or duration_type in ('tramo_end', 'next_tramo_end', 'timed', 'permanent')),
  add constraint card_effects_timed_duration_check
    check (duration_type not in ('timed', 'charges') or duration_value is not null);

alter table public.player_effects
  drop constraint if exists player_effects_normal_limit_duration_check,
  drop constraint if exists player_effects_timed_duration_check;
alter table public.player_effects
  add constraint player_effects_normal_limit_duration_check
    check (effect_key <> 'normal_card_limit'
      or duration_type in ('tramo_end', 'next_tramo_end', 'timed', 'permanent')),
  add constraint player_effects_timed_duration_check
    check (duration_type not in ('timed', 'charges') or duration_value is not null);

alter table public.event_effects
  add constraint event_effects_timed_duration_check
  check (duration_type not in ('timed', 'charges') or duration_value is not null);
