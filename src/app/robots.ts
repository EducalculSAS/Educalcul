import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/offres", "/tarifs", "/faq", "/contact", "/auth/inscription", "/auth/connexion"],
        disallow: ["/parent/", "/child/", "/admin/", "/api/"],
      },
    ],
    sitemap: "https://educalcul.fr/sitemap.xml",
  };
}
