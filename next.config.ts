import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent DNS prefetching
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Prevent MIME type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy — microphone=(self) : necessaire pour la dictee
  // vocale (chat Calia + "Calia en classe"), sinon getUserMedia echoue sans
  // meme proposer la popup de permission au navigateur.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
  // La Content-Security-Policy est posée par src/proxy.ts (nonce par requête) : voir src/lib/csp.ts.
  // ✓ CRITICAL FIX: HSTS - enforce HTTPS
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Le filtre XSS des vieux navigateurs est lui-même une source de failles : la recommandation actuelle est de le désactiver (la CSP protège).
  { key: "X-XSS-Protection", value: "0" },
  // Une page d'un autre site ne peut plus garder de référence vers nos fenêtres ; les fenêtres que NOUS ouvrons (aperçus, paiement) gardent leur lien.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Pas de politique Flash / PDF inter-domaines.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Les pages des espaces connectés sont calculées à la demande : sans préchargement, un clic attendait le serveur
    // avant d'afficher quoi que ce soit. Ici, dès que le pointeur survole un lien (ou que le doigt le touche), la page
    // complète est préchargée : au clic, elle s'ouvre directement. Voir `unstable_dynamicOnHover` sur les liens.
    dynamicOnHover: true,
    // Une page préchargée reste utilisable 30 s (le minimum) : au-delà, elle est redemandée, pour ne pas montrer de données périmées.
    staleTimes: { dynamic: 0, static: 30 },
  },
  turbopack: {
    root: process.cwd(),
  },

  // Le Scanner IA (admin) lit le code source du site à l'exécution pour
  // l'auditer — sans ça, Vercel ne trace que les fichiers réellement
  // importés et un fs.readFile sur une page non importée échouerait en prod
  // (marcherait en local seulement).
  outputFileTracingIncludes: {
    // Les routes API sont des .ts : sans ./src/app/**/*.ts, le scan Sécurité ne trouvait
    // AUCUN fichier en production et concluait « aucun problème ».
    "/api/admin/scanner/run": ["./src/app/**/*.tsx", "./src/app/**/*.ts", "./src/components/**/*.tsx", "./src/lib/**/*.ts"],
  },

  // ✓ SECURITY: Restrict image sources to trusted domains
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "kygsmclnwuiocqyvzrvp.supabase.co" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  
  // Anciennes adresses ou adresses devinées par les moteurs : une seule URL par page (le référencement s'additionne).
  async redirects() {
    return [
      { source: "/methodologie", destination: "/methode-pedagogique", permanent: true },
      { source: "/apprendre-les-maths", destination: "/programmes", permanent: true },
      { source: "/about", destination: "/a-propos", permanent: true },
      { source: "/calia", destination: "/calia-tuteur-ia-maths", permanent: true },
    ];
  },

  // ✓ SECURITY: Apply security headers and CORS
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // ✓ HIGH PRIORITY FIX: CORS - Allow requests only from own domain
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NODE_ENV === "production" ? "https://educalcul.com" : "*",
          },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, PATCH, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-CSRF-Token",
          },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
