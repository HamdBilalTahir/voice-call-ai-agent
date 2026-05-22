"use client";

import { useState, useEffect } from "react";
import { Maximize2, Minimize2, Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { type AgentFullData } from "@/lib/firebase/agents";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

interface InstructionsTabProps {
  agentKey: string;
  initialData?: AgentFullData;
}

interface PromptSections {
  roleAndResponsibilities: string;
  personaLanguageAndTone: string;
  mistakesToAvoid: string;
  additionalInstructions: string;
  voiceGreeting: string;
  voiceInstructions: string;
}

const SECTION_META: Record<
  keyof PromptSections,
  { title: string; helper: string; placeholder: string; required?: boolean }
> = {
  roleAndResponsibilities: {
    title: "What it does",
    helper: "Describe the agent's main job and the outcome you expect.",
    placeholder:
      "e.g. Answer inbound calls from customers looking to book an appointment. Collect their name, preferred date and time, and confirm the booking.",
    required: true,
  },
  personaLanguageAndTone: {
    title: "How it talks",
    helper:
      "Set the tone — friendly, professional, concise. Include phrases to always use or avoid.",
    placeholder:
      "e.g. Speak in a warm, professional tone. Use short sentences. Always address the caller by their first name.",
  },
  mistakesToAvoid: {
    title: "What to avoid",
    helper: "List specific behaviors, topics, or phrases it should never do.",
    placeholder:
      "e.g. Never mention competitor names. Do not promise same-day availability without checking first.",
  },
  additionalInstructions: {
    title: "Anything else",
    helper: "Any extra rules or context that didn't fit above.",
    placeholder: "Add any extra rules or context for your agent.",
  },
  voiceGreeting: {
    title: "Opening line",
    helper: "The first thing the agent says when a call connects.",
    placeholder: 'e.g. "Hi, thanks for calling — how can I help you today?"',
  },
  voiceInstructions: {
    title: "Voice behavior rules",
    helper:
      "Rules specific to the voice channel — pacing, silence handling, etc.",
    placeholder:
      "e.g. Pause for 1 second before responding. If the caller goes silent for 3 seconds, ask if they're still there.",
  },
};

// ─── Stale-version conflict modal ─────────────────────────────────────────────

function ConflictModal({
  updatedByName,
  updatedAt,
  onReload,
  onForce,
  onClose,
}: {
  updatedByName?: string;
  updatedAt?: number;
  onReload: () => void;
  onForce: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl p-6 max-w-md w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Someone else saved changes
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              This agent was updated{" "}
              {updatedAt ? relativeTime(updatedAt) : "recently"}
              {updatedByName ? ` by ${updatedByName}` : ""}. Reload to see the
              latest, or overwrite with your version.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onReload}>
            Reload latest
          </Button>
          <Button variant="destructive" size="sm" onClick={onForce}>
            Overwrite anyway
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InstructionsTab({
  agentKey,
  initialData,
}: InstructionsTabProps) {
  const { toast } = useToast();

  const empty: PromptSections = {
    roleAndResponsibilities: "",
    personaLanguageAndTone: "",
    mistakesToAvoid: "",
    additionalInstructions: "",
    voiceGreeting: "",
    voiceInstructions: "",
  };

  const fromInitial = (d: AgentFullData): PromptSections => ({
    roleAndResponsibilities: d.roleAndResponsibilities ?? "",
    personaLanguageAndTone: d.personaLanguageAndTone ?? "",
    mistakesToAvoid: d.mistakesToAvoid ?? "",
    additionalInstructions: d.additionalInstructions ?? "",
    voiceGreeting: d.voiceGreeting ?? "",
    voiceInstructions: d.voiceInstructions ?? "",
  });

  const [sections, setSections] = useState<PromptSections>(
    initialData ? fromInitial(initialData) : empty,
  );
  const [original, setOriginal] = useState<PromptSections>(
    initialData ? fromInitial(initialData) : empty,
  );
  const [serverUpdatedAt, setServerUpdatedAt] = useState<number | undefined>(
    initialData?.updatedAt,
  );
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof PromptSections, string>>
  >({});
  const [expandedSection, setExpandedSection] = useState<
    keyof PromptSections | null
  >(null);
  const [conflict, setConflict] = useState<{
    currentUpdatedAt?: number;
    updatedByName?: string;
  } | null>(null);

  const isDirty = JSON.stringify(sections) !== JSON.stringify(original);

  // Load from API if no initialData
  useEffect(() => {
    if (initialData) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/agents/${agentKey}`);
        if (!res.ok) throw new Error("Failed");
        const data: AgentFullData = await res.json();
        if (mounted) {
          const s = fromInitial(data);
          setSections(s);
          setOriginal(s);
          setServerUpdatedAt(data.updatedAt);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  // Warn on navigate-away with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const validate = (): boolean => {
    const errors: Partial<Record<keyof PromptSections, string>> = {};
    if (!sections.roleAndResponsibilities.trim()) {
      errors.roleAndResponsibilities =
        "Role & responsibilities is required — it drives the agent's core behaviour.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const doSave = async (force = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: sections,
          updatedBy: "system",
          updatedByName: "App User",
          updatedAt: serverUpdatedAt,
          force,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setConflict({
          currentUpdatedAt: data.currentUpdatedAt,
          updatedByName: data.updatedByName,
        });
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }

      const data = await res.json();
      setOriginal({ ...sections });
      setServerUpdatedAt(data.updatedAt);
      setConflict(null);
      toast({
        message: "Saved — changes will apply on the next call.",
        variant: "success",
      });
    } catch (err: unknown) {
      toast({
        message:
          err instanceof Error
            ? err.message
            : "Couldn't save — check your connection and try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSections({ ...original });
    setFieldErrors({});
  };

  const handleReload = async () => {
    setConflict(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentKey}`);
      if (!res.ok) throw new Error();
      const data: AgentFullData = await res.json();
      const s = fromInitial(data);
      setSections(s);
      setOriginal(s);
      setServerUpdatedAt(data.updatedAt);
    } catch {
      toast({
        message: "Couldn't reload — try refreshing the page.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImproveWithAI = () => {
    toast({
      message: "AI suggestions are on the way — we'll let you know.",
      variant: "info",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-[120px] w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {conflict && (
        <ConflictModal
          updatedByName={conflict.updatedByName}
          updatedAt={conflict.currentUpdatedAt}
          onReload={handleReload}
          onForce={() => {
            setConflict(null);
            void doSave(true);
          }}
          onClose={() => setConflict(null)}
        />
      )}

      <div className="flex flex-col gap-6 text-left">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isDirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <Button
            onClick={() => void doSave()}
            disabled={saving || !isDirty}
            size="sm"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {(Object.keys(SECTION_META) as Array<keyof PromptSections>).map(
            (key) => {
              const meta = SECTION_META[key];
              const isExpanded = expandedSection === key;
              if (expandedSection && !isExpanded) return null;

              return (
                <div
                  key={key}
                  className="py-5 first:pt-0 last:pb-0 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-sm font-medium text-foreground">
                        {meta.title}
                        {meta.required && (
                          <span className="text-destructive ml-0.5">*</span>
                        )}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {meta.helper}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button
                        onClick={handleImproveWithAI}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                      >
                        <Wand2 className="size-3.5" />
                        Improve with AI
                      </button>
                      <button
                        onClick={() =>
                          setExpandedSection(isExpanded ? null : key)
                        }
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <Minimize2 size={15} />
                        ) : (
                          <Maximize2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                  <Textarea
                    value={sections[key]}
                    onChange={(e) => {
                      setSections((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }));
                      if (fieldErrors[key]) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          [key]: undefined,
                        }));
                      }
                    }}
                    className={`font-mono text-xs leading-relaxed ${fieldErrors[key] ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder={meta.placeholder}
                    style={{ minHeight: isExpanded ? "360px" : "120px" }}
                    onInput={(e) => {
                      const t = e.target as HTMLTextAreaElement;
                      t.style.height = "auto";
                      t.style.height = `${t.scrollHeight}px`;
                    }}
                  />
                  {fieldErrors[key] && (
                    <p className="text-xs text-destructive">
                      {fieldErrors[key]}
                    </p>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Sticky unsaved-changes bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-6 py-3 bg-card border-t border-border shadow-lg">
          <p className="text-sm text-muted-foreground">
            You have unsaved changes to{" "}
            <span className="font-medium text-foreground">Instructions</span>.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={() => void doSave()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
