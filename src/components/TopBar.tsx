"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface TopBarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
}

export function TopBar({
  collapsed,
  onToggleCollapse,
  onOpenMobile,
}: TopBarProps) {
  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-white shrink-0 z-20">
      {/* Mobile: hamburger */}
      <button
        className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={onOpenMobile}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Desktop: collapse / expand toggle */}
      <button
        className="hidden lg:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )}
      </button>

      {/* Breadcrumbs */}
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>

      {/* Search */}
      <div className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground cursor-pointer hover:border-primary/40 hover:bg-muted transition-colors w-48">
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">Search…</span>
        <kbd className="hidden md:inline text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 leading-none text-muted-foreground">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}
