// Inactivity menus interrupt active coaching threads and can stack when several
// Slack event paths finish close together. Keep the start card user-initiated.
export function shouldScheduleSlackInactivityStartCard() {
  return false;
}
