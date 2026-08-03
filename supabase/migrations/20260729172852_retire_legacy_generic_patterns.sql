-- Retire broad, legacy derived observations without deleting user history.
-- New observations are created only from specific combinations of voluntarily
-- shared check-ins, schedule shape, and explicitly remembered support feedback.
update public.workday_pattern_summaries
set active = false,
    status = 'dismissed',
    acknowledged_at = coalesce(acknowledged_at, now())
where pattern_key in (
  'break-would-help',
  'lower-capacity-midday',
  'strategy-quiet_block'
)
or pattern_key like 'legacy-%';
