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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);

    function handler() {
      setStep(1);
      setPurpose(null);
      setIndustry(null);
      setLanguage(null);
      setOpen(true);
    }
    window.addEventListener("open-welcome-modal", handler);
    return () => window.removeEventListener("open-welcome-modal", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  function handleGenerate() {
    setStep("generating");
    setTimeout(() => setStep("done"), 1800);
  }

  function handleGoToPlayground() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
    router.push("/playground");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={step !== "generating" ? dismiss : undefined}
      />

      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden animate-in zoom-in-95 fade-in-0 duration-200">
        {/* Step dots */}
        {typeof step === "number" && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {[1, 2, 3].map((n) => (
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

        {/* Dismiss (skip) */}
        {step !== "generating" && step !== "done" && (
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
            aria-label="Skip"
          >
            <X className="size-4" />
          </button>
        )}

        <div className="px-8 pt-14 pb-8">
          {/* ── Step 1: Purpose ── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-center mb-1.5">
                What do you want your AI to do?
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-7">
                We&apos;ll pre-configure the right agent type for you.
              </p>

              <div className="space-y-2.5">
                {PURPOSE_OPTIONS.map(({ value, icon: Icon, label, sub }) => (
                  <OptionCard
                    key={value}
                    selected={purpose === value}
                    onClick={() => setPurpose(value)}
                  >
                    <div className="flex items-center gap-4 px-4 py-4">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="size-5 text-primary" />
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
                disabled={!purpose}
                onClick={() => setStep(2)}
                className="mt-7 w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
              <p className="text-sm text-muted-foreground text-center mb-7">
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

              <div className="mt-7 flex gap-3">
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

          {/* ── Step 3: Language ── */}
          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold text-center mb-1.5">
                What language should it speak?
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-7">
                You can add more languages later.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {LANGUAGE_OPTIONS.map(({ value, label, flag }) => (
                  <OptionCard
                    key={value}
                    selected={language === value}
                    onClick={() => setLanguage(value)}
                  >
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="text-xl">{flag}</span>
                      <span className="text-sm font-medium text-foreground">
                        {label}
                      </span>
                    </div>
                  </OptionCard>
                ))}
              </div>

              <div className="mt-7 flex gap-3">
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
                  Generate my agent <ArrowRight className="size-4" />
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
                <h2 className="text-xl font-semibold">Building your agent…</h2>
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
                <h2 className="text-xl font-semibold">Your agent is ready!</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-[300px] mx-auto">
                  We&apos;ve set it up with defaults for your industry and
                  language. Go hear it in action — should feel like a real
                  person.
                </p>
              </div>
              <button
                onClick={handleGoToPlayground}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                Test it in Playground <ArrowRight className="size-4" />
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
