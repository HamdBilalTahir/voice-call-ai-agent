"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  Bot,
  FlaskConical,
  PhoneCall,
  Hash,
  BookOpen,
  BarChart2,
  Plug,
  Users,
  CreditCard,
  HelpCircle,
  ChevronDown,
  Plus,
  Building2,
  ExternalLink,
  Settings,
  LogOut,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { AgentConfig } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";

interface SidebarProps {
  agents: AgentConfig[];
  collapsed: boolean;
  onCollapse: (val: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onMobileOpen: () => void;
}

const PRIMARY_NAV = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    id: "agents",
    label: "Agents",
    href: "/agents",
    icon: Bot,
    expandable: true,
  },
  {
    id: "playground",
    label: "Playground",
    href: "/playground",
    icon: FlaskConical,
  },
  { id: "calls", label: "Call History", href: "/calls", icon: PhoneCall },
  { id: "numbers", label: "Phone Numbers", href: "/numbers", icon: Hash },
  { id: "knowledge", label: "Knowledge", href: "/knowledge", icon: BookOpen },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: BarChart2 },
] as const;

const SECONDARY_NAV = [
  {
    id: "integrations",
    label: "Integrations",
    href: "/settings/api",
    icon: Plug,
  },
  { id: "team", label: "Team", href: "/settings/team", icon: Users },
  {
    id: "billing",
    label: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
  },
] as const;

const MOBILE_TABS = [
  { id: "dashboard", label: "Home", href: "/", icon: LayoutDashboard },
  { id: "agents", label: "Agents", href: "/agents", icon: Bot },
  { id: "calls", label: "Calls", href: "/calls", icon: PhoneCall },
] as const;

function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group/tooltip relative">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-foreground text-background text-xs rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  external,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  external?: boolean;
}) {
  const cls = cn(
    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors w-full",
    active
      ? "bg-sidebar-accent text-sidebar-primary"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
    collapsed && "justify-center px-2",
  );

  const inner = (
    <>
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && external && (
        <ExternalLink className="size-3 text-muted-foreground shrink-0" />
      )}
    </>
  );

  const el = external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );

  if (collapsed) {
    return <Tooltip label={label}>{el}</Tooltip>;
  }
  return el;
}

function SidebarInner({
  agents,
  collapsed,
  agentsExpanded,
  onToggleAgents,
  pathname,
}: {
  agents: AgentConfig[];
  collapsed: boolean;
  agentsExpanded: boolean;
  onToggleAgents: () => void;
  pathname: string;
}) {
  const isAgentsActive = pathname.startsWith("/agents");
  const router = useRouter();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {},
  );
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingKey) renameInputRef.current?.focus();
  }, [editingKey]);

  const startRename = useCallback(
    (key: string, currentName: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setEditingKey(key);
      setEditingValue(nameOverrides[key] ?? currentName);
    },
    [nameOverrides],
  );

  const saveRename = useCallback(
    async (agent: AgentConfig) => {
      const trimmed = editingValue.trim();
      setEditingKey(null);
      if (!trimmed || trimmed === (nameOverrides[agent.key] ?? agent.name))
        return;
      setNameOverrides((prev) => ({ ...prev, [agent.key]: trimmed }));
      try {
        await fetch(`/api/agents/${agent.key}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: { name: trimmed },
            updatedBy: "system",
            updatedByName: "App User",
          }),
        });
        const agentPath = `/agents/${agent.direction}/${agent.key}`;
        if (pathname === agentPath || pathname.startsWith(agentPath + "?")) {
          router.refresh();
        }
      } catch {
        setNameOverrides((prev) => {
          const next = { ...prev };
          delete next[agent.key];
          return next;
        });
      }
    },
    [editingValue, nameOverrides, pathname, router],
  );

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
        setLogoutConfirm(false);
      }
    }
    if (avatarMenuOpen) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [avatarMenuOpen]);

  return (
    <>
      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {PRIMARY_NAV.map((item) => {
          if (item.id === "agents") {
            const active = isAgentsActive;

            const trigger = (
              <button
                onClick={onToggleAgents}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors w-full",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                <Bot className="size-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">Agents</span>
                    <ChevronDown
                      className={cn(
                        "size-3.5 text-muted-foreground transition-transform duration-200",
                        agentsExpanded && "rotate-180",
                      )}
                    />
                  </>
                )}
              </button>
            );

            return (
              <div key="agents">
                {collapsed ? (
                  <Tooltip label="Agents">{trigger}</Tooltip>
                ) : (
                  trigger
                )}

                {agentsExpanded && !collapsed && (
                  <div className="mt-1 ml-4 pl-3 border-l border-border space-y-0.5 pb-1">
                    {agents.map((agent) => {
                      const agentPath = `/agents/${agent.direction}/${agent.key}`;
                      const isActive =
                        pathname === agentPath ||
                        pathname.startsWith(agentPath + "?") ||
                        pathname.startsWith(agentPath + "/");
                      const displayName =
                        nameOverrides[agent.key] ?? agent.name;
                      const isRenaming = editingKey === agent.key;
                      return (
                        <div
                          key={agent.key}
                          className="group relative flex items-center"
                        >
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => saveRename(agent)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename(agent);
                                if (e.key === "Escape") setEditingKey(null);
                              }}
                              className="flex-1 px-2 py-1.5 rounded-md text-[13px] bg-sidebar-accent text-sidebar-primary border border-primary/40 outline-none min-w-0"
                            />
                          ) : (
                            <>
                              <Link
                                href={agentPath}
                                className={cn(
                                  "flex flex-1 items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors min-w-0 pr-7",
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                                )}
                              >
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full shrink-0 transition-colors",
                                    agent.voiceEnabled
                                      ? "bg-success animate-pulse"
                                      : "bg-muted-foreground/50",
                                  )}
                                  title={agent.voiceEnabled ? "Live" : "Paused"}
                                />
                                <span className="truncate">{displayName}</span>
                              </Link>
                              <button
                                onClick={(e) =>
                                  startRename(agent.key, displayName, e)
                                }
                                title="Rename agent"
                                className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("open-welcome-modal"),
                        )
                      }
                      className="flex items-center gap-1.5 px-2 py-1.5 w-full rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Plus className="size-3" />
                      New agent
                    </button>
                  </div>
                )}
              </div>
            );
          }

          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <NavLink
              key={item.id}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* Secondary nav */}
      <div className="px-2 pt-2 pb-1 border-t border-sidebar-border space-y-0.5">
        {!collapsed && (
          <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Account
          </p>
        )}
        {SECONDARY_NAV.map((item) => (
          <NavLink
            key={item.id}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={pathname.startsWith(item.href)}
            collapsed={collapsed}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
        <NavLink
          href="https://docs.example.com"
          icon={HelpCircle}
          label="Help & Docs"
          active={false}
          collapsed={collapsed}
          external
        />

        {/* User row with avatar menu */}
        <div ref={menuRef} className="relative">
          {/* Dropdown menu */}
          {avatarMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl shadow-lg py-1 z-50 overflow-hidden">
              <Link
                href="/settings/profile"
                onClick={() => {
                  setAvatarMenuOpen(false);
                  setLogoutConfirm(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Settings className="size-4 text-muted-foreground shrink-0" />
                Settings
              </Link>
              <div className="border-t border-border my-1" />
              {!logoutConfirm ? (
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="size-4 shrink-0" />
                  Log out
                </button>
              ) : (
                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Are you sure you want to log out?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLogoutConfirm(false)}
                      className="flex-1 px-2 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setLogoutConfirm(false);
                      }}
                      className="flex-1 px-2 py-1 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {collapsed ? (
            <Tooltip label="My Account">
              <button
                onClick={() => {
                  setAvatarMenuOpen((v) => !v);
                  setLogoutConfirm(false);
                }}
                className="flex items-center justify-center w-full px-2 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
              >
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary select-none">
                    AJ
                  </span>
                </div>
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={() => {
                setAvatarMenuOpen((v) => !v);
                setLogoutConfirm(false);
              }}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors text-left"
            >
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary select-none">
                  AJ
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                  Alex Johnson
                </p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  alex@company.com
                </p>
              </div>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function Sidebar({
  agents,
  collapsed,
  mobileOpen,
  onMobileClose,
  onMobileOpen,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCollapse: _onCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const isAgentsActive = pathname.startsWith("/agents");
  const [agentsExpanded, setAgentsExpanded] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAgentsActive) setAgentsExpanded(true);
  }, [isAgentsActive]);

  const desktopSidebar = (
    <div
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Workspace switcher */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-sidebar-border shrink-0 gap-2.5 px-3",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Building2 className="size-4 text-white" />
        </div>
        {!collapsed && (
          <span className="flex-1 text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
            My Workspace
          </span>
        )}
      </div>

      <SidebarInner
        agents={agents}
        collapsed={collapsed}
        agentsExpanded={agentsExpanded}
        onToggleAgents={() => setAgentsExpanded((v) => !v)}
        pathname={pathname}
      />
    </div>
  );

  const mobileSidebar = (
    <div className="flex flex-col h-full w-64 bg-sidebar border-r border-sidebar-border">
      {/* Workspace switcher */}
      <div className="h-16 flex items-center border-b border-sidebar-border shrink-0 gap-2.5 px-3">
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Building2 className="size-4 text-white" />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-sidebar-foreground truncate">
          My Workspace
        </span>
      </div>

      <SidebarInner
        agents={agents}
        collapsed={false}
        agentsExpanded={agentsExpanded}
        onToggleAgents={() => setAgentsExpanded((v) => !v)}
        pathname={pathname}
      />
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-30">
        {desktopSidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in-0 duration-150"
            onClick={onMobileClose}
          />
          <aside className="relative z-10 h-full animate-in slide-in-from-left-full duration-200">
            {mobileSidebar}
          </aside>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40 flex items-stretch h-16">
        {MOBILE_TABS.map(({ id, label, href, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={id}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
        <button
          onClick={onMobileOpen}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors"
        >
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
    </>
  );
}
