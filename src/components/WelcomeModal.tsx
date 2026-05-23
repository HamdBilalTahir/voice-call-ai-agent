"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CheckCircle,
  Loader2,
  Bot,
  ArrowRight,
  Phone,
  PhoneOutgoing,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "onboarding-done";

type Step = 1 | 2 | 3 | "generating" | "done";
type Purpose = "inbound" | "outbound" | "both";
type Industry = "restaurant" | "clinic" | "agency" | "other";
type Language = "en" | "es" | "fr" | "other";

const PURPOSE_OPTIONS: {
  value: Purpose;
  icon: React.ElementType;
  label: string;
  sub: string;
}[] = [
  {
    value: "inbound",
    icon: Phone,
    label: "Answer calls",
    sub: "Handle inbound calls 24/7",
  },
  {
    value: "outbound",
    icon: PhoneOutgoing,
    label: "Make calls",
    sub: "Dial leads automatically",
  },
  {
    value: "both",
    icon: Shuffle,
    label: "Both",
    sub: "Full inbound + outbound coverage",
  },
];

const INDUSTRY_OPTIONS: { value: Industry; emoji: string; label: string }[] = [
  { value: "restaurant", emoji: "🍽️", label: "Restaurant" },
  { value: "clinic", emoji: "🏥", label: "Clinic" },
  { value: "agency", emoji: "📊", label: "Agency" },
  { value: "other", emoji: "⚡", label: "Other" },
];

const LANGUAGE_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "es", label: "Spanish", flag: "🇪🇸" },
  { value: "fr", label: "French", flag: "🇫🇷" },
  { value: "other", label: "Other", flag: "🌐" },
];

function OptionCard({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full text-left rounded-xl border-2 transition-all duration-150",
        selected
          ? "border-primary bg-accent"
          : "border-border hover:border-primary/30 hover:bg-muted/40",
        className,
      )}
    >
      {selected && (
        <CheckCircle className="absolute top-3 right-3 size-4 text-primary" />
      )}
      {children}
    </button>
  );
}

export function WelcomeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [whatItDoes, setWhatItDoes] = useState("");
  const [howItTalks, setHowItTalks] = useState("");
  const [whatToAvoid, setWhatToAvoid] = useState("");
  const [anythingElse, setAnythingElse] = useState("");
  const [openingLine, setOpeningLine] = useState("");
  const [createError, setCreateError] = useState("");
  const [newAgentKey, setNewAgentKey] = useState("");

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);

    function handler() {
      setStep(1);
      setPurpose(null);
      setIndustry(null);
      setLanguage(null);
      setAgentName("");
      setAgentDescription("");
      setWhatItDoes("");
      setHowItTalks("");
      setWhatToAvoid("");
      setAnythingElse("");
      setOpeningLine("");
      setCreateError("");
      setNewAgentKey("");
      setOpen(true);
    }
    window.addEventListener("open-welcome-modal", handler);
    return () => window.removeEventListener("open-welcome-modal", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  async function handleGenerate() {
    if (!agentName.trim() || !language) return;
    setStep("generating");
    setCreateError("");
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName.trim(),
          description: agentDescription.trim(),
          purpose,
          industry,
          language,
          whatItDoes: whatItDoes.trim(),
          howItTalks: howItTalks.trim(),
          whatToAvoid: whatToAvoid.trim(),
          anythingElse: anythingElse.trim(),
          openingLine: openingLine.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create agent");
      }
      const data = await res.json();
      setNewAgentKey(data.key);
      setStep("done");
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create agent",
      );
      setStep(3);
    }
  }

  function handleGoToPlayground() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
    router.push(
      newAgentKey ? `/playground?agent=${newAgentKey}` : "/playground",
    );
  }

  if (!open) return null;

  const totalSteps = 3;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={step !== "generating" ? dismiss : undefined}
      />

      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in-95 fade-in-0 duration-200">
        {/* Step dots */}
        {typeof step === "number" && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  n === step
                    ? "w-6 bg-primary"
                    : n < step
                      ? "w-3 bg-primary/40"
                      : "w-3 bg-muted",
                )}
              />
            ))}
          </div>
        )}

        {/* Dismiss */}
        {step !== "generating" && step !== "done" && (
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
          >
            <X className="size-4" />
          </button>
        )}

        <div className="px-8 pt-14 pb-8">
          {/* ── Step 1: Name + Purpose ── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-center mb-1.5">
                Create your AI agent
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Give it a name and choose what it will do.
              </p>

              {/* Agent name */}
              <div className="mb-5">
                <label
                  htmlFor="wm-agent-name"
                  className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5"
                >
                  Agent name
                </label>
                <input
                  id="wm-agent-name"
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Sales Bot, Booking Assistant…"
                  className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                />
              </div>

              {/* Description */}
              <div className="mb-5">
                <label
                  htmlFor="wm-agent-description"
                  className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5"
                >
                  Description{" "}
                  <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="wm-agent-description"
                  type="text"
                  value={agentDescription}
                  onChange={(e) => setAgentDescription(e.target.value)}
                  placeholder="e.g. Qualifies leads and books consultations for real estate…"
                  className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                />
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                {PURPOSE_OPTIONS.map(({ value, icon: Icon, label, sub }) => (
                  <OptionCard
                    key={value}
                    selected={purpose === value}
                    onClick={() => setPurpose(value)}
                  >
                    <div className="flex items-center gap-4 px-4 py-3.5">
                      <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {label}
                        </p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                    </div>
                  </OptionCard>
                ))}
              </div>

              <button
                disabled={!purpose || !agentName.trim()}
                onClick={() => setStep(2)}
                className="mt-6 w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="size-4" />
              </button>
            </>
          )}

          {/* ── Step 2: Industry ── */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-center mb-1.5">
                What&apos;s your industry?
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                We&apos;ll fill in sensible defaults for your sector.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {INDUSTRY_OPTIONS.map(({ value, emoji, label }) => (
                  <OptionCard
                    key={value}
                    selected={industry === value}
                    onClick={() => setIndustry(value)}
                    className="text-center"
                  >
                    <div className="flex flex-col items-center gap-2 py-5 px-3">
                      <span className="text-3xl">{emoji}</span>
                      <p className="text-sm font-medium text-foreground">
                        {label}
                      </p>
                    </div>
                  </OptionCard>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button
                  disabled={!industry}
                  onClick={() => setStep(3)}
                  className="flex-[2] py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="size-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Language + All prompt sections ── */}
          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold text-center mb-1.5">
                Final details
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-5">
                Set the language and describe what your agent should do.
              </p>

              {/* Language */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Language
              </p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {LANGUAGE_OPTIONS.map(({ value, label, flag }) => (
                  <OptionCard
                    key={value}
                    selected={language === value}
                    onClick={() => setLanguage(value)}
                  >
                    <div className="flex items-center gap-3 px-3 py-3">
                      <span className="text-lg">{flag}</span>
                      <span className="text-sm font-medium text-foreground">
                        {label}
                      </span>
                    </div>
                  </OptionCard>
                ))}
              </div>

              {/* All 5 prompt sections */}
              <div className="space-y-4">
                {/* What it does */}
                <div>
                  <label
                    htmlFor="wm-what-it-does"
                    className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5"
                  >
                    What it does
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    The agent&apos;s main job and the outcome you expect.
                  </p>
                  <textarea
                    id="wm-what-it-does"
                    value={whatItDoes}
                    onChange={(e) => setWhatItDoes(e.target.value)}
                    placeholder="e.g. You are a sales agent for Acme Corp. Your goal is to qualify leads and book demo calls…"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors resize-none"
                  />
                </div>

                {/* How it talks */}
                <div>
                  <label
                    htmlFor="wm-how-it-talks"
                    className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5"
                  >
                    How it talks
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Tone, style, phrases to use or avoid.
                  </p>
                  <textarea
                    id="wm-how-it-talks"
                    value={howItTalks}
                    onChange={(e) => setHowItTalks(e.target.value)}
                    placeholder="e.g. Speak in a warm, professional tone. Use short sentences. Never say 'I don't know'…"
                    rows={2}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors resize-none"
                  />
                </div>

                {/* What to avoid */}
                <div>
                  <label
                    htmlFor="wm-what-to-avoid"
                    className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5"
                  >
                    What to avoid
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Behaviors, topics, or phrases it should never do.
                  </p>
                  <textarea
                    id="wm-what-to-avoid"
                    value={whatToAvoid}
                    onChange={(e) => setWhatToAvoid(e.target.value)}
                    placeholder="e.g. Never discuss competitor pricing. Don't make promises about delivery dates…"
                    rows={2}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors resize-none"
                  />
                </div>

                {/* Anything else */}
                <div>
                  <label
                    htmlFor="wm-anything-else"
                    className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5"
                  >
                    Anything else
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Any extra context, rules, or edge cases.
                  </p>
                  <textarea
                    id="wm-anything-else"
                    value={anythingElse}
                    onChange={(e) => setAnythingElse(e.target.value)}
                    placeholder="e.g. If the caller asks for a manager, say one will call back within 24 hours…"
                    rows={2}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors resize-none"
                  />
                </div>

                {/* Opening line */}
                <div>
                  <label
                    htmlFor="wm-opening-line"
                    className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5"
                  >
                    Opening line
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    The exact words your agent says to start the call.
                  </p>
                  <textarea
                    id="wm-opening-line"
                    value={openingLine}
                    onChange={(e) => setOpeningLine(e.target.value)}
                    placeholder="e.g. Hey, this is Alex from Acme. Is now a good time to chat about your growth goals?"
                    rows={2}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors resize-none"
                  />
                </div>
              </div>

              {createError && (
                <p className="mt-4 text-xs text-destructive bg-destructive/5 border border-destructive/20 px-3 py-2 rounded-lg">
                  {createError}
                </p>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button
                  disabled={!language}
                  onClick={handleGenerate}
                  className="flex-[2] py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  Create agent <ArrowRight className="size-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Generating ── */}
          {step === "generating" && (
            <div className="py-10 flex flex-col items-center gap-5 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="size-8 text-primary animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Creating {agentName}…</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Setting up instructions, voice, and defaults.
                </p>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-3/4 animate-pulse" />
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="py-6 flex flex-col items-center gap-5 text-center">
              <div className="size-16 rounded-2xl bg-success/10 flex items-center justify-center">
                <Bot className="size-8 text-success" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{agentName} is ready!</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-[300px] mx-auto">
                  Open the Playground to fill in the full prompt and test it
                  with a live call.
                </p>
              </div>
              <button
                onClick={handleGoToPlayground}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                Open in Playground <ArrowRight className="size-4" />
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                I&apos;ll explore on my own
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
