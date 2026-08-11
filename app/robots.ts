import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://meetbeckett.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/beta", "/features", "/integrations", "/skills", "/privacy", "/support", "/terms"],
        disallow: ["/admin", "/api", "/auth", "/dashboard", "/outlook-addin"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
