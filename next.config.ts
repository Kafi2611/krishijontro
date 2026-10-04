// Next.js settings. The next-intl plugin connects our language files to the app.
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Points next-intl to the file that picks the language for each request.
const withNextIntl = createNextIntlPlugin("./src/lib/i18n-request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
