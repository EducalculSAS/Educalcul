import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/offres",
          "/tarifs",
          "/faq",
          "/contact",
          "/programmes",
          "/programmes/",
          "/calia-tuteur-ia-maths",
          "/methode-pedagogique",
          "/a-propos",
          "/auth/inscription",
          "/auth/connexion",
          "/mentions-legales",
          "/politique-confidentialite",
          "/cgu",
          "/cgv",
        ],
        disallow: ["/parent/", "/child/", "/admin/", "/api/", "/dashboard"],
      },
    ],
    sitemap: "https://educalcul.com/sitemap.xml",
    host: "https://educalcul.com",
  };
}
