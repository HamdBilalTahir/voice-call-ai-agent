"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const UNCLICKABLE = new Set(["agents", "outbound", "inbound"]);

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-muted-foreground"
    >
      <Link href="/" className="hover:text-foreground transition-colors">
        Home
      </Link>

      {segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const isUnclickable = UNCLICKABLE.has(segment.toLowerCase());

        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-border" aria-hidden />
            {isLast || isUnclickable ? (
              <span
                className={
                  isLast ? "text-foreground font-medium" : "capitalize"
                }
              >
                {decodeURIComponent(segment)}
              </span>
            ) : (
              <Link
                href={path}
                className="hover:text-foreground transition-colors capitalize"
              >
                {decodeURIComponent(segment)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
