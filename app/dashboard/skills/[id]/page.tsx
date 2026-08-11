import { permanentRedirect } from "next/navigation";

export default async function LegacySkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/dashboard/courses/${encodeURIComponent(id)}`);
}
