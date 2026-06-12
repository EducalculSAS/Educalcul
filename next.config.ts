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
  // Permissions policy
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // ✓ CRITICAL FIX: Content-Security-Policy to prevent XSS
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://js.stripe.com https://m.stripe.network https://api.openrouter.ai; frame-src https://js.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  // ✓ CRITICAL FIX: HSTS - enforce HTTPS
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Additional XSS protection
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
  
  // ✓ SECURITY: Restrict image sources to trusted domains
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "kygsmclnwuiocqyvzrvp.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
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
