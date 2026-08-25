import SettingsPanel from "@/components/dashboard/SettingsPanel";
import AboutPage from "../about/page";

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <AboutPage />
      <SettingsPanel />
    </div>
  );
}
