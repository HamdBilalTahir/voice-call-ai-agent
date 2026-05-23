"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Maximize2,
  Minimize2,
  Wand2,
  AlertCircle,
  Eye,
  Copy,
  X,
  Info,
} from "lucide-react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromptSections {
  roleAndResponsibilities: string;
  personaLanguageAndTone: string;
  mistakesToAvoid: string;
  additionalInstructions: string;
  voiceGreeting: string;
}

interface SectionMeta {
  title: string;
  helper: string;
  placeholder: string;
  required?: boolean;
  outboundRequired?: boolean;
}

const SECTION_META: Record<keyof PromptSections, SectionMeta> = {
  roleAndResponsibilities: {
    title: "What it does",
    helper: "The agent's main job and the outcome you expect.",
    placeholder:
      "e.g. Answer inbound calls from customers looking to book an appointment. Collect their name, preferred date and time, and confirm the booking.",
    required: true,
  },
  personaLanguageAndTone: {
    title: "How it talks",
    helper: "Tone, style, phrases to use or avoid.",
    placeholder:
      "e.g. Speak in a warm, professional tone. Use short sentences. Always address the caller by their first name.",
  },
  mistakesToAvoid: {
    title: "What to avoid",
    helper: "Behaviors, topics, or phrases it should never do.",
    placeholder:
      "e.g. Never mention competitor names. Do not promise same-day availability without checking first.",
  },
  additionalInstructions: {
    title: "Anything else",
    helper: "Extra rules or context that didn't fit above.",
    placeholder: "Add any extra rules or context for your agent.",
  },
  voiceGreeting: {
    title: "Opening line",
    helper: "The first thing the agent says when a call connects.",
    placeholder:
      "e.g. Hi, this is Maya from Sunrise Clinic — how can I help you today?",
    outboundRequired: true,
  },
};

interface InstructionsTabProps {
  agentKey: string;
  initialData?: AgentFullData;
}

// ─── Conflict modal ───────────────────────────────────────────────────────────

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

// ─── Preview modal ────────────────────────────────────────────────────────────

function HighlightedPrompt({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <pre className="font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        /^\[.+\]$/.test(part) ? (
          <span key={i} className="text-primary font-semibold">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </pre>
  );
}

function PreviewModal({
  agentKey,
  isDirty,
  onClose,
}: {
  agentKey: string;
  isDirty: boolean;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/agents/${agentKey}/compiled-prompt`);
        if (!res.ok) throw new Error();
        const text = await res.text();
        if (mounted) setPrompt(text);
      } catch {
        if (mounted) setPrompt("Failed to load compiled prompt.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [agentKey]);

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              What your agent sees on every call
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              The full instruction set assembled from your inputs. Read-only.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-4">
            <button
              onClick={handleCopy}
              disabled={!prompt || loading}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-40"
            >
              <Copy className="size-3.5" />
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ) : prompt ? (
            <HighlightedPrompt text={prompt} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No prompt available.
            </p>
          )}
        </div>

        {isDirty && (
          <div className="px-6 py-3 border-t border-amber-200 bg-amber-50 flex items-center gap-2 rounded-b-2xl">
            <Info className="size-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              You have unsaved changes — this preview reflects your last saved
              version.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── InstructionsTab ──────────────────────────────────────────────────────────

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
  };

  const fromInitial = (d: AgentFullData): PromptSections => ({
    roleAndResponsibilities: d.roleAndResponsibilities ?? "",
    personaLanguageAndTone: d.personaLanguageAndTone ?? "",
    mistakesToAvoid: d.mistakesToAvoid ?? "",
    additionalInstructions: d.additionalInstructions ?? "",
    voiceGreeting: d.voiceGreeting ?? "",
  });

  const [sections, setSections] = useState<PromptSections>(
    initialData ? fromInitial(initialData) : empty,
  );
  const [original, setOriginal] = useState<PromptSections>(
    initialData ? fromInitial(initialData) : empty,
  );
  const [callType, setCallType] = useState<"inbound" | "outbound">(
    initialData?.voiceSettings?.callType ?? "inbound",
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
  const [showPreview, setShowPreview] = useState(false);
  const [showMigrationBanner, setShowMigrationBanner] = useState(
    initialData?.migrationApplied === true,
  );

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
          setCallType(data.voiceSettings?.callType ?? "inbound");
          setServerUpdatedAt(data.updatedAt);
          setShowMigrationBanner(data.migrationApplied === true);
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

  const validate = useCallback(
    (values: PromptSections = sections): boolean => {
      const errors: Partial<Record<keyof PromptSections, string>> = {};

      if (!values.roleAndResponsibilities.trim()) {
        errors.roleAndResponsibilities =
          "What it does is required — your agent needs to know its job.";
      }
      if (callType === "outbound" && !values.voiceGreeting.trim()) {
        errors.voiceGreeting =
          "Outbound agents need an opening line — it's the first thing the caller hears.";
      }
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    },
    [sections, callType],
  );

  const clearMigrationBanner = useCallback(async () => {
    setShowMigrationBanner(false);
    try {
      await fetch(`/api/agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { migrationApplied: false },
          updatedBy: "system",
          updatedByName: "App User",
        }),
      });
    } catch {
      // non-critical — banner is already dismissed locally
    }
  }, [agentKey]);

  const doSave = async (force = false) => {
    const trimmed: PromptSections = {
      roleAndResponsibilities: sections.roleAndResponsibilities.trim(),
      personaLanguageAndTone: sections.personaLanguageAndTone.trim(),
      mistakesToAvoid: sections.mistakesToAvoid.trim(),
      additionalInstructions: sections.additionalInstructions.trim(),
      voiceGreeting: sections.voiceGreeting.trim(),
    };

    if (!validate(trimmed)) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: trimmed,
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
      setSections(trimmed);
      setOriginal(trimmed);
      setServerUpdatedAt(data.updatedAt);
      setConflict(null);

      if (showMigrationBanner) {
        void clearMigrationBanner();
      }

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
      setCallType(data.voiceSettings?.callType ?? "inbound");
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

      {showPreview && (
        <PreviewModal
          agentKey={agentKey}
          isDirty={isDirty}
          onClose={() => setShowPreview(false)}
        />
      )}

      <div className="flex flex-col gap-6 text-left">
        {/* Migration banner */}
        {showMigrationBanner && (
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-blue-800">
              We&apos;ve reorganised your agent&apos;s instructions into clearer
              sections. Take a moment to review and click Save to confirm
              everything looks right.
            </p>
            <button
              onClick={() => void clearMigrationBanner()}
              className="text-blue-500 hover:text-blue-700 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

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

              const isRequired =
                meta.required ||
                (meta.outboundRequired && callType === "outbound");

              return (
                <div
                  key={key}
                  className="py-5 first:pt-0 last:pb-0 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-sm font-medium text-foreground">
                        {meta.title}
                        {isRequired && (
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
                    <p className="text-xs text-destructive mt-1">
                      {fieldErrors[key]}
                    </p>
                  )}
                </div>
              );
            },
          )}
        </div>

        {/* Preview affordance */}
        <div className="flex justify-center pt-2 pb-1">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Eye className="size-3.5" />
            Preview what your agent sees
          </button>
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
