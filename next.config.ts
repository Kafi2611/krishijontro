// Next.js settings. The next-intl plugin connects our language files to the app.
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Points next-intl to the file that picks the language for each request.
const withNextIntl = createNextIntlPlugin("./src/lib/i18n-request.ts");

/**
 * Safety headers sent with every page and file. They tell the browser to:
 * - never show our site inside a frame on another website ("clickjacking": a hidden frame
 *   could trick a person into pressing our buttons): X-Frame-Options and frame-ancestors
 * - trust the file type we send, not guess it: X-Content-Type-Options
 * - send only our site's address (not the full page address) to other websites: Referrer-Policy
 * - allow only our own pages to ask for the location ("Use my location"), and nobody to use the
 *   camera or microphone: Permissions-Policy
 * - always use https from now on (browsers ignore this on http://localhost): Strict-Transport-Security
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Do not tell visitors which framework the site uses ("X-Powered-By: Next.js").
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  images: {
    // next/image only shows pictures from other websites that are listed here. On Vercel the
    // uploaded photos live in Vercel Blob (see lib/services/upload.ts), at addresses like
    // https://<store id>.public.blob.vercel-storage.com/uploads/<name>.jpg
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/uploads/**" },
    ],
  },
};

export default withNextIntl(nextConfig);
