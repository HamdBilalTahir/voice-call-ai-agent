"use client";

import { useState } from "react";
import { AgentConfig } from "@/lib/agents/registry";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/ui/toast";
import { WelcomeModal } from "@/components/WelcomeModal";
import { SetupChecklist } from "@/components/SetupChecklist";

interface AppLayoutProps {
  agents: AgentConfig[];
  children: React.ReactNode;
}

export function AppLayout({ agents, children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          agents={agents}
          collapsed={collapsed}
          onCollapse={setCollapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onMobileOpen={() => setMobileOpen(true)}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
            onOpenMobile={() => setMobileOpen(true)}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-24 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      <WelcomeModal />
      <SetupChecklist agentExists={agents.length > 0} />
    </ToastProvider>
  );
}
