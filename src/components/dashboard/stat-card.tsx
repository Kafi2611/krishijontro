// A small dashboard box with a big number, e.g. "3 machines waiting".
// If `href` is given, the whole box is a link to the page with the details.
import { useFormatter } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  highlight?: boolean; // amber colour, to draw attention (e.g. items waiting)
};

export function StatCard({ label, value, icon, href, highlight = false }: StatCardProps) {
  const format = useFormatter(); // Bangla digits on Bangla pages

  const card = (
    <Card className={cn("h-full transition-shadow", href && "hover:shadow-md", highlight && "bg-amber-50 ring-amber-200")}>
      <CardContent className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold">{format.number(value)}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) {
    return card;
  }
  return (
    <Link href={href} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {card}
    </Link>
  );
}
