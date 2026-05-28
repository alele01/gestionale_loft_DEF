import type { NextConfig } from "next";

/**
 * Global response headers applied to every Next.js-served route.
 *
 * Notes:
 *   - HSTS: 2 years + includeSubDomains + preload. Vercel terminates
 *     TLS, so we are safe to advertise HSTS unconditionally.
 *   - Referrer-Policy: `strict-origin-when-cross-origin` is the modern
 *     default; it leaks only the origin (no path/query) cross-site.
 *   - Permissions-Policy: deny the three sensors we never use; this is
 *     the minimum responsible default. Add more as needed.
 *   - We deliberately do NOT set a wide Content-Security-Policy
 *     (default-src etc.) yet: it can break Stripe Checkout redirects,
 *     React Email previews, and Resend tracking pixels in unexpected
 *     ways. We only set `frame-ancestors`, which is the part with
 *     direct attack-surface impact (clickjacking of the admin UI and
 *     embed iframe origin restriction).
 */
const COMMON_SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/**
 * Origins allowed to embed `/embed/[eventSlug]` in an <iframe>. Update
 * this list when adding new customer sites. Wildcard subdomains are
 * supported by modern browsers (`https://*.cookergirl.com`).
 */
const EMBED_FRAME_ANCESTORS = [
  "'self'",
  "https://loft.cookergirl.com",
  "https://*.cookergirl.com",
].join(" ");

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // /embed/* is meant to be iframed from cookergirl.com only.
        source: "/embed/:path*",
        headers: [
          ...COMMON_SECURITY_HEADERS,
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${EMBED_FRAME_ANCESTORS}`,
          },
        ],
      },
      {
        // Everything else (admin UI, /complete, /pay, /payment, etc.)
        // must NEVER be embeddable to prevent clickjacking of admin
        // actions and payment redirect flows.
        source: "/((?!embed).*)",
        headers: [
          ...COMMON_SECURITY_HEADERS,
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
