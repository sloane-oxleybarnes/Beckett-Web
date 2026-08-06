create policy "No client access to Google Workspace link sessions"
  on public.google_workspace_addon_link_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);
