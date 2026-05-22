"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  X,
  CheckCircle,
  Circle,
  ArrowRight,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "setup-checklist-dismissed";
const STEPS_KEY = "setup-checklist-checked";

const STEPS = [
  { id: "create-agent", label: "Create your first agent", href: null },
  { id: "test-playground", label: "Test in Playground", href: "/playground" },
  { id: "buy-number", label: "Assign a phone number", href: "/settings/api" },
  { id: "first-call", label: "Make your first real call", href: "/calls" },
  { id: "invite-teammate", label: "Invite a teammate", href: "/settings/team" },
] as const;

interface SetupChecklistProps {
  agentExists: boolean;
}

export function SetupChecklist({ agentExists }: SetupChecklistProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (localStorage.getItem(DISMISS_KEY) === "true") {
      setDismissed(true);
      return;
    }
    const stored = localStorage.getItem(STEPS_KEY);
    if (stored) {
      try {
        setChecked(new Set(JSON.parse(stored) as string[]));
      } catch {
        /* ignore malformed data */
      }
    }
  }, []);

  const effectiveChecked = new Set(checked);
  if (agentExists) effectiveChecked.add("create-agent");

  const done = STEPS.filter((s) => effectiveChecked.has(s.id)).length;
  const total = STEPS.length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  function toggle(id: string) {
    if (id === "create-agent" && agentExists) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(STEPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  if (!mounted || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-40 w-72 bg-card border border-border rounded-2xl shadow-xl overflow-hidden transition-all duration-200",
        allDone && "border-success/30",
      )}
    >
      {/* Header row — outer div intentional; nested dismiss button prevents using <button> */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none",
          allDone ? "bg-success/8" : "bg-muted/20",
        )}
        onClick={() => setCollapsed((v) => !v)}
      >
        <Rocket
          className={cn(
            "size-4 shrink-0",
            allDone ? "text-success" : "text-primary",
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {allDone ? "All set! 🎉" : "Get started"}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            {done}/{total} steps complete
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
            collapsed && "rotate-180",
          )}
        />
      </div>

      {!collapsed && (
        <>
          {/* Progress bar */}
          <div className="px-4 pb-2 pt-0.5">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  allDone ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Step list */}
          <div className="px-2 pb-3 space-y-0.5">
            {STEPS.map((step) => {
              const isChecked = effectiveChecked.has(step.id);
              const isAutoChecked = step.id === "create-agent" && agentExists;

              const isToggleable = !isAutoChecked && !step.href;
              const RowTag: React.ElementType = isToggleable ? "button" : "div";
              const rowContent = (
                <RowTag
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group/step",
                    isToggleable && "w-full text-left",
                    isChecked
                      ? "opacity-60"
                      : step.href
                        ? "hover:bg-muted cursor-pointer"
                        : "cursor-default",
                  )}
                  onClick={isToggleable ? () => toggle(step.id) : undefined}
                >
                  {isChecked ? (
                    <CheckCircle className="size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span
                    className={cn(
                      "flex-1 text-xs font-medium leading-tight",
                      isChecked
                        ? "line-through text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  {!isChecked && step.href && (
                    <ArrowRight className="size-3 text-muted-foreground/40 group-hover/step:text-primary transition-colors shrink-0" />
                  )}
                </RowTag>
              );

              if (!isChecked && step.href) {
                return (
                  <Link
                    key={step.id}
                    href={step.href}
                    className="block"
                    onClick={() => toggle(step.id)}
                  >
                    {rowContent}
                  </Link>
                );
              }
              return <div key={step.id}>{rowContent}</div>;
            })}
          </div>

          {allDone && (
            <div className="px-4 pb-4 text-center border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">
                All set — you can dismiss this now.
              </p>
              <button
                onClick={(e) => handleDismiss(e)}
                className="text-xs font-medium text-success hover:underline"
              >
                Dismiss checklist
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
