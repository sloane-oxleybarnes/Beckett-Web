-- Retire broad, legacy derived observations. New observations are created only
-- from specific combinations of voluntarily shared check-ins, schedule shape,
-- and explicitly remembered support feedback.
delete from public.workday_pattern_summaries
where pattern_key in (
  'break-would-help',
  'lower-capacity-midday',
  'strategy-quiet_block'
)
or pattern_key like 'legacy-%';
