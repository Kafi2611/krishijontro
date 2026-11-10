// Next.js settings. The next-intl plugin connects our language files to the app.
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Points next-intl to the file that picks the language for each request.
const withNextIntl = createNextIntlPlugin("./src/lib/i18n-request.ts");

const nextConfig: NextConfig = {
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
