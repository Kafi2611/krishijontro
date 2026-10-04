"use client";
// On phones the sidebar is hidden. This "hamburger" button opens it as a sliding panel.
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav, type SidebarLink } from "./sidebar-nav";

type MobileNavProps = {
  items: SidebarLink[];
  areaLabel: string; // e.g. "Farmer"
};

export function MobileNav({ items, areaLabel }: MobileNavProps) {
  const t = useTranslations("Common");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("menu")}>
          <Menu className="size-6" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>{t("appName")}</SheetTitle>
          <SheetDescription>{areaLabel}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          {/* Close the panel after a link is tapped */}
          <SidebarNav items={items} onNavigate={() => setIsOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
