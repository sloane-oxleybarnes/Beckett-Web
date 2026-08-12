import MeetingPrepPanel from "./MeetingPrepPanel";
import { redirect } from "next/navigation";

export default async function MeetingPrepPage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  if (!(await searchParams).title) redirect("/dashboard/calendar");
  return <MeetingPrepPanel />;
}
