"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-neutral-400 mb-6">
      <Link href="/" className="hover:text-white transition-colors">
        Home
      </Link>
      {segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        // Make non-leaf segments unclickable if they correspond to intermediate routes that don't exist
        const isUnclickable =
          segment.toLowerCase() === "agents" ||
          segment.toLowerCase() === "outbound" ||
          segment.toLowerCase() === "inbound";

        return (
          <div key={path} className="flex items-center space-x-2">
            <span className="text-neutral-600">/</span>
            {isLast || isUnclickable ? (
              <span
                className={`capitalize ${isLast ? "text-white" : "text-neutral-500"}`}
              >
                {segment}
              </span>
            ) : (
              <Link
                href={path}
                className="hover:text-white transition-colors capitalize"
              >
                {segment}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
