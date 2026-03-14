"use client";

import { useState, useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

interface AIJobDescriptionTabProps {
  agentKey: string;
}

interface PromptSections {
  roleAndResponsibilities: string;
  personaLanguageAndTone: string;
  mistakesToAvoid: string;
  additionalInstructions: string;
}

const SECTION_TITLES = {
  roleAndResponsibilities: "Role and Responsibilities",
  personaLanguageAndTone: "Persona Language and Tone",
  mistakesToAvoid: "Mistakes to Avoid",
  additionalInstructions: "Additional Instructions",
} as const;

export function AIJobDescriptionTab({ agentKey }: AIJobDescriptionTabProps) {
  const [sections, setSections] = useState<PromptSections>({
    roleAndResponsibilities: "",
    personaLanguageAndTone: "",
    mistakesToAvoid: "",
    additionalInstructions: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          setSections(data);
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sections),
      });
      if (!response.ok) throw new Error("Failed to save prompt");
      alert("Prompt saved successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to save prompt.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-neutral-800 h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col items-start gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <span className="text-sm text-neutral-400">
          Changes take effect after restarting the agent.
        </span>
      </div>

      <div className="flex flex-col divide-y divide-neutral-700">
        {(Object.keys(SECTION_TITLES) as Array<keyof PromptSections>).map(
          (key) => {
            const isExpanded = expandedSection === key;

            if (expandedSection && !isExpanded) return null;

            return (
              <div
                key={key}
                className="py-6 first:pt-0 last:pb-0 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    {SECTION_TITLES[key]}
                  </h3>
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : key)}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-md transition-colors"
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <Minimize2 size={18} />
                    ) : (
                      <Maximize2 size={18} />
                    )}
                  </button>
                </div>
                <textarea
                  value={sections[key]}
                  onChange={(e) =>
                    setSections((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-neutral-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm resize-none"
                  style={{ minHeight: isExpanded ? "400px" : "150px" }}
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
