// Catches every URL that matches no page (e.g. /en/abc) and shows our
// translated "Page not found" page from [locale]/not-found.tsx.
import { notFound } from "next/navigation";

export default function CatchAllPage() {
  notFound();
}
