"use client";

import { useState, useEffect } from "react";
import { Maximize2, Minimize2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

interface InstructionsTabProps {
  agentKey: string;
}

interface PromptSections {
  roleAndResponsibilities: string;
  personaLanguageAndTone: string;
  mistakesToAvoid: string;
  additionalInstructions: string;
}

const SECTION_META: Record<
  keyof PromptSections,
  { title: string; helper: string; placeholder: string }
> = {
  roleAndResponsibilities: {
    title: "What it does",
    helper: "Describe the agent's main job and the outcome you expect.",
    placeholder:
      "e.g. Answer inbound calls from customers looking to book an appointment. Collect their name, preferred date and time, and confirm the booking.",
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
};

export function InstructionsTab({ agentKey }: InstructionsTabProps) {
  const { toast } = useToast();
  const [sections, setSections] = useState<PromptSections>({
    roleAndResponsibilities: "",
    personaLanguageAndTone: "",
    mistakesToAvoid: "",
    additionalInstructions: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [expandedSection, setExpandedSection] = useState<
    keyof PromptSections | null
  >(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPrompt = async () => {
      try {
        const response = await fetch(`/api/agents/${agentKey}/prompt`);
        if (!response.ok) throw new Error("Failed to fetch prompt");
        const data = await response.json();
        if (isMounted) {
          setSections({
            roleAndResponsibilities: data.roleAndResponsibilities ?? "",
            personaLanguageAndTone: data.personaLanguageAndTone ?? "",
            mistakesToAvoid: data.mistakesToAvoid ?? "",
            additionalInstructions: data.additionalInstructions ?? "",
          });
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) setLoading(false);
      }
    };
    fetchPrompt();
    return () => {
      isMounted = false;
    };
  }, [agentKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/agents/${agentKey}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sections),
      });
      if (!response.ok) throw new Error("Failed to save prompt");
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (error) {
      console.error(error);
      toast({
        message:
          "Couldn't save your instructions — check your connection and try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
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
    <div className="flex flex-col gap-6 text-left">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Changes are live in a few seconds.
        </p>
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          variant={savedOk ? "secondary" : "default"}
        >
          {saving ? "Saving…" : savedOk ? "Saved ✓" : "Save"}
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
                  onChange={(e) =>
                    setSections((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="font-mono text-xs leading-relaxed"
                  placeholder={meta.placeholder}
                  style={{ minHeight: isExpanded ? "360px" : "120px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
