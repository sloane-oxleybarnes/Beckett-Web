import { Suspense } from "react";
import SettingsPanel from "@/components/dashboard/SettingsPanel";

export default function SettingsPage() {
  return <Suspense fallback={null}><SettingsPanel /></Suspense>;
}
