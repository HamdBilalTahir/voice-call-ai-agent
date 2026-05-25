"use client";

import { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth, getIdToken } from "@/contexts/AuthContext";
import { type AgentFullData, type VoiceSettings } from "@/lib/firebase/agents";

// ─── Provider / model catalogue ──────────────────────────────────────────────

const LLM_PROVIDERS = [
  {
    value: "google" as const,
    label: "Google Gemini",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      {
        value: "gemini-2.0-flash-thinking-exp",
        label: "Gemini 2.0 Flash Thinking",
      },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
  },
  {
    value: "openai" as const,
    label: "OpenAI",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
  },
];

const TTS_PROVIDERS = [
  {
    value: "elevenlabs" as const,
    label: "ElevenLabs",
    models: [
      { value: "sonic-3", label: "Sonic 3" },
      { value: "sonic-2", label: "Sonic 2" },
      { value: "eleven_turbo_v2_5", label: "Turbo v2.5" },
      { value: "eleven_multilingual_v2", label: "Multilingual v2" },
    ],
  },
  {
    value: "cartesia" as const,
    label: "Cartesia",
    models: [
      { value: "sonic-2024-10-19", label: "Sonic (Oct 2024)" },
      { value: "sonic-english", label: "Sonic English" },
    ],
  },
];

const STT_PROVIDERS = [
  {
    value: "deepgram" as const,
    label: "Deepgram",
    models: [
      { value: "nova-3", label: "Nova 3" },
      { value: "nova-2", label: "Nova 2" },
      { value: "enhanced", label: "Enhanced" },
    ],
  },
];

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

// ─── Types ────────────────────────────────────────────────────────────────────

type LlmProvider = "google" | "openai";
type TtsProvider = "elevenlabs" | "cartesia";
type SttProvider = "deepgram";

interface SavedKey {
  id: string;
  provider: string;
  label: string;
  maskedKey: string;
}

interface FormState {
  language: string;
  sttLanguage: string;
  voiceType: string;
  ttsVoiceId: string;
  // LLM
  llmProvider: LlmProvider;
  llmModel: string;
  llmConfigId: string;
  // TTS
  ttsProvider: TtsProvider;
  ttsModel: string;
  ttsConfigId: string;
  // STT
  sttProvider: SttProvider;
  sttModel: string;
  sttConfigId: string;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
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

// ─── FieldRow / SelectField / TextInput ──────────────────────────────────────

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
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
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

// ─── ApiKeyPicker ─────────────────────────────────────────────────────────────

function ApiKeyPicker({
  provider,
  value,
  onChange,
  savedKeys,
  onKeySaved,
  onKeyDeleted,
}: {
  provider: string;
  value: string;
  onChange: (configId: string) => void;
  savedKeys: SavedKey[];
  onKeySaved: (key: SavedKey) => void;
  onKeyDeleted: (configId: string) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingNew) inputRef.current?.focus();
  }, [addingNew]);

  const handleSaveKey = async () => {
    if (!newKey.trim() || !user) return;
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/provider-configs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          label: newLabel.trim() || provider,
          apiKey: newKey.trim(),
        }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to save");
      const saved: SavedKey = await res.json();
      onKeySaved(saved);
      onChange(saved.id);
      setAddingNew(false);
      setNewLabel("");
      setNewKey("");
      toast({ message: "API key saved.", variant: "success" });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Failed to save key",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!user) return;
    setDeleting(configId);
    try {
      const token = await getIdToken();
      await fetch(`/api/provider-configs/${configId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      onKeyDeleted(configId);
      if (value === configId) onChange("");
      toast({ message: "Key removed.", variant: "success" });
    } catch {
      toast({ message: "Failed to remove key.", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  const keysForProvider = savedKeys.filter((k) => k.provider === provider);

  if (!user) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Sign in to manage API keys.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__add__") {
              setAddingNew(true);
            } else {
              onChange(e.target.value);
              setAddingNew(false);
            }
          }}
          className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— use environment variable —</option>
          {keysForProvider.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} ({k.maskedKey})
            </option>
          ))}
          <option value="__add__">+ Add new key…</option>
        </select>

        {value && value !== "__add__" && (
          <button
            type="button"
            title="Remove this key"
            disabled={deleting === value}
            onClick={() => void handleDelete(value)}
            className="flex items-center justify-center size-9 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {addingNew && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Key className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              New API key
            </span>
          </div>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Production)"
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            ref={inputRef}
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Paste your API key"
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddingNew(false);
                setNewLabel("");
                setNewKey("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving || !newKey.trim()}
              onClick={() => void handleSaveKey()}
            >
              <Plus className="size-3.5 mr-1" />
              {saving ? "Saving…" : "Save key"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProviderSection ──────────────────────────────────────────────────────────

function ProviderSection({
  title,
  providerValue,
  providerOptions,
  onProviderChange,
  modelValue,
  modelOptions,
  onModelChange,
  configId,
  onConfigIdChange,
  savedKeys,
  onKeySaved,
  onKeyDeleted,
  providerKey,
}: {
  title: string;
  providerValue: string;
  providerOptions: { value: string; label: string }[];
  onProviderChange: (v: string) => void;
  modelValue: string;
  modelOptions: { value: string; label: string }[];
  onModelChange: (v: string) => void;
  configId: string;
  onConfigIdChange: (v: string) => void;
  savedKeys: SavedKey[];
  onKeySaved: (k: SavedKey) => void;
  onKeyDeleted: (id: string) => void;
  providerKey: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
        {title}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Provider">
          <SelectField
            value={providerValue}
            onChange={onProviderChange}
            options={providerOptions}
          />
        </FieldRow>
        <FieldRow label="Model">
          <SelectField
            value={modelValue}
            onChange={onModelChange}
            options={modelOptions}
          />
        </FieldRow>
      </div>

      <FieldRow
        label="API key"
        helper="Select a saved key or add a new one. Leave blank to use the server environment variable."
      >
        <ApiKeyPicker
          provider={providerKey}
          value={configId}
          onChange={onConfigIdChange}
          savedKeys={savedKeys}
          onKeySaved={onKeySaved}
          onKeyDeleted={onKeyDeleted}
        />
      </FieldRow>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VoiceBehaviorTabProps {
  agentKey: string;
  initialData?: AgentFullData;
  onVoiceEnabledChange?: (enabled: boolean) => void;
}

type WritableVoiceSettings = Omit<VoiceSettings, "callType">;

export function VoiceBehaviorTab({
  agentKey,
  initialData,
  onVoiceEnabledChange,
}: VoiceBehaviorTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const fromData = (d: AgentFullData): FormState => {
    const vs = d.voiceSettings;
    const llmProv = (vs?.llmProvider ?? "google") as LlmProvider;
    const ttsProv = (vs?.ttsProvider ?? "elevenlabs") as TtsProvider;
    const sttProv = (vs?.sttProvider ?? "deepgram") as SttProvider;

    const llmProvConfig = LLM_PROVIDERS.find((p) => p.value === llmProv)!;
    const ttsProvConfig = TTS_PROVIDERS.find((p) => p.value === ttsProv)!;
    const sttProvConfig = STT_PROVIDERS.find((p) => p.value === sttProv)!;

    const llmModel =
      vs?.llmModel && llmProvConfig.models.some((m) => m.value === vs.llmModel)
        ? vs.llmModel
        : llmProvConfig.models[0].value;

    const ttsModel =
      vs?.ttsModel && ttsProvConfig.models.some((m) => m.value === vs.ttsModel)
        ? vs.ttsModel
        : ttsProvConfig.models[0].value;

    const sttModel =
      vs?.sttModel && sttProvConfig.models.some((m) => m.value === vs.sttModel)
        ? vs.sttModel
        : sttProvConfig.models[0].value;

    return {
      language: vs?.language ?? "en-US",
      sttLanguage: vs?.sttLanguage ?? "multi",
      voiceType: vs?.voiceType ?? "female-1",
      ttsVoiceId: vs?.ttsVoiceId ?? "",
      llmProvider: llmProv,
      llmModel,
      llmConfigId: vs?.llmConfigId ?? "",
      ttsProvider: ttsProv,
      ttsModel,
      ttsConfigId: vs?.ttsConfigId ?? "",
      sttProvider: sttProv,
      sttModel,
      sttConfigId: vs?.sttConfigId ?? "",
    };
  };

  const defaultForm: FormState = {
    language: "en-US",
    sttLanguage: "multi",
    voiceType: "female-1",
    ttsVoiceId: "",
    llmProvider: "google",
    llmModel: "gemini-2.0-flash",
    llmConfigId: "",
    ttsProvider: "elevenlabs",
    ttsModel: "sonic-3",
    ttsConfigId: "",
    sttProvider: "deepgram",
    sttModel: "nova-3",
    sttConfigId: "",
  };

  const [form, setForm] = useState<FormState>(
    initialData ? fromData(initialData) : defaultForm,
  );
  const [original, setOriginal] = useState<FormState>(
    initialData ? fromData(initialData) : defaultForm,
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

  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  // Load saved provider config keys
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setKeysLoading(true);
    const load = async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/provider-configs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: SavedKey[] = await res.json();
        if (mounted) setSavedKeys(data);
      } catch {
        // silently fail — keys just won't show
      } finally {
        if (mounted) setKeysLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [user]);

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
    void load();
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

  // When provider changes, reset model to that provider's first model
  const handleLlmProviderChange = (v: string) => {
    const prov = v as LlmProvider;
    const models = LLM_PROVIDERS.find((p) => p.value === prov)?.models ?? [];
    setForm((prev) => ({
      ...prev,
      llmProvider: prov,
      llmModel: models[0]?.value ?? prev.llmModel,
      llmConfigId: "",
    }));
  };

  const handleTtsProviderChange = (v: string) => {
    const prov = v as TtsProvider;
    const models = TTS_PROVIDERS.find((p) => p.value === prov)?.models ?? [];
    setForm((prev) => ({
      ...prev,
      ttsProvider: prov,
      ttsModel: models[0]?.value ?? prev.ttsModel,
      ttsConfigId: "",
    }));
  };

  const handleSttProviderChange = (v: string) => {
    const prov = v as SttProvider;
    const models = STT_PROVIDERS.find((p) => p.value === prov)?.models ?? [];
    setForm((prev) => ({
      ...prev,
      sttProvider: prov,
      sttModel: models[0]?.value ?? prev.sttModel,
      sttConfigId: "",
    }));
  };

  const doSave = async (force = false) => {
    setSaving(true);
    const voiceSettings: Partial<WritableVoiceSettings> = {
      language: form.language,
      sttLanguage: form.sttLanguage,
      voiceType: form.voiceType,
      ttsVoiceId: form.ttsVoiceId || undefined,
      llmProvider: form.llmProvider,
      llmModel: form.llmModel,
      llmConfigId: form.llmConfigId || undefined,
      ttsProvider: form.ttsProvider,
      ttsModel: form.ttsModel,
      ttsConfigId: form.ttsConfigId || undefined,
      sttProvider: form.sttProvider,
      sttModel: form.sttModel,
      sttConfigId: form.sttConfigId || undefined,
    };

    const userId = user?.uid;

    try {
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            voiceSettings,
            ...(userId ? { userId } : {}),
          },
          updatedBy: user?.uid ?? "system",
          updatedByName: user?.displayName ?? user?.email ?? "App User",
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

  const llmProviderObj = LLM_PROVIDERS.find(
    (p) => p.value === form.llmProvider,
  )!;
  const ttsProviderObj = TTS_PROVIDERS.find(
    (p) => p.value === form.ttsProvider,
  )!;
  const sttProviderObj = STT_PROVIDERS.find(
    (p) => p.value === form.sttProvider,
  )!;

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

        {/* LLM */}
        <div className="bg-card border border-border rounded-xl p-5">
          <ProviderSection
            title="Language model (LLM)"
            providerValue={form.llmProvider}
            providerOptions={LLM_PROVIDERS.map((p) => ({
              value: p.value,
              label: p.label,
            }))}
            onProviderChange={handleLlmProviderChange}
            modelValue={form.llmModel}
            modelOptions={llmProviderObj.models}
            onModelChange={(v) => set("llmModel", v)}
            configId={form.llmConfigId}
            onConfigIdChange={(v) => set("llmConfigId", v)}
            savedKeys={keysLoading ? [] : savedKeys}
            onKeySaved={(k) => setSavedKeys((prev) => [k, ...prev])}
            onKeyDeleted={(id) =>
              setSavedKeys((prev) => prev.filter((k) => k.id !== id))
            }
            providerKey={form.llmProvider}
          />
        </div>

        {/* TTS */}
        <div className="bg-card border border-border rounded-xl p-5">
          <ProviderSection
            title="Text-to-speech (TTS)"
            providerValue={form.ttsProvider}
            providerOptions={TTS_PROVIDERS.map((p) => ({
              value: p.value,
              label: p.label,
            }))}
            onProviderChange={handleTtsProviderChange}
            modelValue={form.ttsModel}
            modelOptions={ttsProviderObj.models}
            onModelChange={(v) => set("ttsModel", v)}
            configId={form.ttsConfigId}
            onConfigIdChange={(v) => set("ttsConfigId", v)}
            savedKeys={keysLoading ? [] : savedKeys}
            onKeySaved={(k) => setSavedKeys((prev) => [k, ...prev])}
            onKeyDeleted={(id) =>
              setSavedKeys((prev) => prev.filter((k) => k.id !== id))
            }
            providerKey={form.ttsProvider}
          />
        </div>

        {/* STT */}
        <div className="bg-card border border-border rounded-xl p-5">
          <ProviderSection
            title="Speech-to-text (STT)"
            providerValue={form.sttProvider}
            providerOptions={STT_PROVIDERS.map((p) => ({
              value: p.value,
              label: p.label,
            }))}
            onProviderChange={handleSttProviderChange}
            modelValue={form.sttModel}
            modelOptions={sttProviderObj.models}
            onModelChange={(v) => set("sttModel", v)}
            configId={form.sttConfigId}
            onConfigIdChange={(v) => set("sttConfigId", v)}
            savedKeys={keysLoading ? [] : savedKeys}
            onKeySaved={(k) => setSavedKeys((prev) => [k, ...prev])}
            onKeyDeleted={(id) =>
              setSavedKeys((prev) => prev.filter((k) => k.id !== id))
            }
            providerKey={form.sttProvider}
          />
        </div>

        {/* Voice & Language (advanced) */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Voice & Language
            </span>
            {showAdvanced ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>

          {showAdvanced && (
            <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border pt-5">
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
                helper="Language the STT engine listens for. Multi-language auto-detects."
              >
                <SelectField
                  value={form.sttLanguage}
                  onChange={(v) => set("sttLanguage", v)}
                  options={STT_LANGUAGE_OPTIONS}
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
