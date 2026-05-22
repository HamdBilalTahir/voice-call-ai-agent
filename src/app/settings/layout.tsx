"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Building2,
  Bell,
  CreditCard,
  Users,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "profile", label: "Profile", href: "/settings/profile", icon: User },
  {
    id: "workspace",
    label: "Workspace",
    href: "/settings/workspace",
    icon: Building2,
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/settings/notifications",
    icon: Bell,
  },
  {
    id: "billing",
    label: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
  },
  { id: "team", label: "Team", href: "/settings/team", icon: Users },
  {
    id: "api",
    label: "API & Integrations",
    href: "/settings/api",
    icon: KeyRound,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
      {/* Sub-nav rail — vertical on desktop, horizontal scroll on mobile */}
      <nav className="sm:w-48 sm:shrink-0 sm:border-r sm:border-border sm:pr-6 sm:pt-0.5">
        <p className="hidden sm:block px-1 mb-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Settings
        </p>
        <div className="flex sm:flex-col sm:space-y-0.5 gap-1 sm:gap-0 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-3 sm:pb-0 border-b border-border sm:border-b-0">
          {NAV.map(({ id, label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  "flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors shrink-0 sm:w-full whitespace-nowrap",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex-1 min-w-0 max-w-2xl">{children}</div>
    </div>
  );
}
