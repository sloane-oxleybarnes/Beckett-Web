import MeetingPrepPanel from "./MeetingPrepPanel";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function MeetingPrepPage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  const resolvedSearchParams = await searchParams;
  if (!resolvedSearchParams.title) redirect("/dashboard/calendar");
  return <Suspense fallback={null}><MeetingPrepPanel /></Suspense>;
}
