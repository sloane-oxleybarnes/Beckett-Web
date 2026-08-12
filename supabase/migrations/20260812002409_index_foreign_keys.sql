create index if not exists adaptive_conversation_sessions_contact_id_idx
  on public.adaptive_conversation_sessions(contact_id);
create index if not exists contact_relationship_summaries_contact_id_idx
  on public.contact_relationship_summaries(contact_id);
create index if not exists contacts_user_id_idx
  on public.contacts(user_id);
create index if not exists course_content_updated_by_idx
  on public.course_content(updated_by);
create index if not exists outlook_sso_link_attempts_user_id_idx
  on public.outlook_sso_link_attempts(user_id);
create index if not exists profiles_team_id_idx
  on public.profiles(team_id);
create index if not exists slack_coaching_bot_messages_user_id_idx
  on public.slack_coaching_bot_messages(user_id);
create index if not exists slack_credit_reservations_beckett_user_id_idx
  on public.slack_credit_reservations(beckett_user_id);
create index if not exists slack_flow_bot_messages_beckett_user_id_idx
  on public.slack_flow_bot_messages(beckett_user_id);
create index if not exists slack_installations_installer_user_id_idx
  on public.slack_installations(installer_user_id);
create index if not exists slack_usage_events_beckett_user_id_idx
  on public.slack_usage_events(beckett_user_id);
