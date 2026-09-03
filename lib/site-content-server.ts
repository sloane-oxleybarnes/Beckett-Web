import { platformRepository } from "@/lib/repositories/platform-repository";
import { SITE_CONTENT_DEFAULTS } from "@/lib/site-content";

type SiteContentRow = {
  key: string;
  value: string | null;
};

export async function getSiteContent(keys?: string[]) {
  const defaults = keys
    ? keys.reduce<Record<string, string>>((acc, key) => {
        acc[key] = SITE_CONTENT_DEFAULTS[key] ?? "";
        return acc;
      }, {})
    : { ...SITE_CONTENT_DEFAULTS };

  try {
    let query = platformRepository.from("site_content").select("key, value");
    if (keys?.length) query = query.in("key", keys);
    const { data, error } = await query;
    if (error) return defaults;

    return (data as SiteContentRow[] | null)?.reduce<Record<string, string>>(
      (acc, row) => {
        if (row.value !== null && row.value !== undefined) acc[row.key] = row.value;
        return acc;
      },
      defaults,
    ) ?? defaults;
  } catch {
    return defaults;
  }
}
