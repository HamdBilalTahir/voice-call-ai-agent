"use client";

import { useState, useEffect } from "react";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { type AgentFullData, type VoiceSettings } from "@/lib/firebase/agents";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

interface VoiceBehaviorTabProps {
  agentKey: string;
  initialData?: AgentFullData;
  onVoiceEnabledChange?: (enabled: boolean) => void;
}

type WritableVoiceSettings = Omit<VoiceSettings, "callType">;

interface FormState {
  language: string;
  sttLanguage: string;
  voiceType: string;
  ttsVoiceId: string;
  sttModel: string;
  ttsModel: string;
  llmModel: string;
}

const VOICE_TYPE_OPTIONS = [
  { value: "female-1", label: "Female — Warm" },
  { value: "female-2", label: "Female — Professional" },
  { value: "male-1", label: "Male — Warm" },
  { value: "male-2", label: "Male — Professional" },
];

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-MX", label: "Spanish (Mexico)" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ar-SA", label: "Arabic" },
];

const STT_LANGUAGE_OPTIONS = [
  { value: "multi", label: "Auto-detect (multi-language)" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
];

// ─── Conflict modal (reused pattern) ─────────────────────────────────────────

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

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

// ─── VoiceBehaviorTab ─────────────────────────────────────────────────────────

export function VoiceBehaviorTab({
  agentKey,
  initialData,
  onVoiceEnabledChange,
}: VoiceBehaviorTabProps) {
  const { toast } = useToast();

  const fromData = (d: AgentFullData): FormState => ({
    language: d.voiceSettings?.language ?? "en-US",
    sttLanguage: d.voiceSettings?.sttLanguage ?? "multi",
    voiceType: d.voiceSettings?.voiceType ?? "female-1",
    ttsVoiceId: d.voiceSettings?.ttsVoiceId ?? "",
    sttModel: d.voiceSettings?.sttModel ?? "nova-3",
    ttsModel: d.voiceSettings?.ttsModel ?? "sonic-3",
    llmModel: d.voiceSettings?.llmModel ?? "gemini-2.0-flash",
  });

  const [form, setForm] = useState<FormState>(
    initialData
      ? fromData(initialData)
      : {
          language: "en-US",
          sttLanguage: "multi",
          voiceType: "female-1",
          ttsVoiceId: "",
          sttModel: "nova-3",
          ttsModel: "sonic-3",
          llmModel: "gemini-2.0-flash",
        },
  );
  const [original, setOriginal] = useState<FormState>(
    initialData
      ? fromData(initialData)
      : {
          language: "en-US",
          sttLanguage: "multi",
          voiceType: "female-1",
          ttsVoiceId: "",
          sttModel: "nova-3",
          ttsModel: "sonic-3",
          llmModel: "gemini-2.0-flash",
        },
  );
  const [callType, setCallType] = useState<"inbound" | "outbound">(
    initialData?.voiceSettings?.callType ?? "inbound",
  );
  const [serverUpdatedAt, setServerUpdatedAt] = useState<number | undefined>(
    initialData?.updatedAt,
  );
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [conflict, setConflict] = useState<{
    currentUpdatedAt?: number;
    updatedByName?: string;
  } | null>(null);

  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  useEffect(() => {
    if (initialData) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/agents/${agentKey}`);
        if (!res.ok) throw new Error();
        const data: AgentFullData = await res.json();
        if (mounted) {
          const s = fromData(data);
          setForm(s);
          setOriginal(s);
          setCallType(data.voiceSettings?.callType ?? "inbound");
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

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const doSave = async (force = false) => {
    setSaving(true);
    const voiceSettings: Partial<WritableVoiceSettings> = {
      language: form.language,
      sttLanguage: form.sttLanguage,
      voiceType: form.voiceType,
      ttsVoiceId: form.ttsVoiceId || undefined,
      sttModel: form.sttModel,
      ttsModel: form.ttsModel,
      llmModel: form.llmModel,
    };

    try {
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { voiceSettings },
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
      setOriginal({ ...form });
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

  const handleReload = async () => {
    setConflict(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentKey}`);
      if (!res.ok) throw new Error();
      const data: AgentFullData = await res.json();
      const s = fromData(data);
      setForm(s);
      setOriginal(s);
      setCallType(data.voiceSettings?.callType ?? "inbound");
      setServerUpdatedAt(data.updatedAt);
      onVoiceEnabledChange?.(data.voiceEnabled);
    } catch {
      toast({
        message: "Couldn't reload — try refreshing the page.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
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

      <div className="flex flex-col gap-6">
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

        {/* Direction — read-only */}
        <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Direction</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set by your phone number configuration — not editable here.
            </p>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
            {callType === "inbound" ? "Answers calls" : "Makes calls"}
          </span>
        </div>

        {/* Core voice settings */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Voice
          </h3>

          <FieldRow
            label="Language"
            helper="Language the agent speaks with callers."
          >
            <SelectField
              value={form.language}
              onChange={(v) => set("language", v)}
              options={LANGUAGE_OPTIONS}
            />
          </FieldRow>

          <FieldRow
            label="Voice type"
            helper="Personality of the synthesised voice."
          >
            <SelectField
              value={form.voiceType}
              onChange={(v) => set("voiceType", v)}
              options={VOICE_TYPE_OPTIONS}
            />
          </FieldRow>

          <FieldRow
            label="Voice ID"
            helper="Specific voice UUID from your TTS provider. Leave blank to use the default for the selected type."
          >
            <TextInput
              value={form.ttsVoiceId}
              onChange={(v) => set("ttsVoiceId", v)}
              placeholder="e.g. a0e99841-438c-4a64-b679-ae501e7d6091"
            />
          </FieldRow>

          <FieldRow
            label="Speech recognition language"
            helper="Language the speech-to-text engine listens for. Multi-language auto-detects."
          >
            <SelectField
              value={form.sttLanguage}
              onChange={(v) => set("sttLanguage", v)}
              options={STT_LANGUAGE_OPTIONS}
            />
          </FieldRow>
        </div>

        {/* Advanced settings (power-user) */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Advanced
            </span>
            {showAdvanced ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>

          {showAdvanced && (
            <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">
                These settings affect model selection. Changing them may impact
                latency and cost.
              </p>

              <FieldRow
                label="STT model"
                helper="Speech-to-text model (e.g. nova-3, nova-2)."
              >
                <TextInput
                  value={form.sttModel}
                  onChange={(v) => set("sttModel", v)}
                  placeholder="nova-3"
                />
              </FieldRow>

              <FieldRow
                label="TTS model"
                helper="Text-to-speech model (e.g. sonic-3, sonic-2)."
              >
                <TextInput
                  value={form.ttsModel}
                  onChange={(v) => set("ttsModel", v)}
                  placeholder="sonic-3"
                />
              </FieldRow>

              <FieldRow
                label="LLM model"
                helper="Language model used for reasoning (e.g. gemini-2.0-flash)."
              >
                <TextInput
                  value={form.llmModel}
                  onChange={(v) => set("llmModel", v)}
                  placeholder="gemini-2.0-flash"
                />
              </FieldRow>
            </div>
          )}
        </div>
      </div>

      {/* Sticky unsaved-changes bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-6 py-3 bg-card border-t border-border shadow-lg">
          <p className="text-sm text-muted-foreground">
            You have unsaved changes to{" "}
            <span className="font-medium text-foreground">
              Voice & Behavior
            </span>
            .
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForm({ ...original })}
            >
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
