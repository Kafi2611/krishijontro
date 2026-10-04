// Language-aware versions of the Next.js navigation tools.
// Always import Link / redirect / useRouter / usePathname from HERE (not from "next/link"
// or "next/navigation"), so links automatically keep the /en or /bn at the start.
import { createNavigation } from "next-intl/navigation";
import { routing } from "@/lib/i18n";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
