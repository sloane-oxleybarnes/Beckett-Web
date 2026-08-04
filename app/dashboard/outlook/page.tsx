import { redirect } from "next/navigation";

/**
 * Outlook coaching now lives in the Outlook task pane. Keep this legacy URL
 * as a handoff so old bookmarks do not strand users on a duplicate mail UI.
 */
export default function OutlookHandoffPage() {
  redirect("/outlook-addin");
}
