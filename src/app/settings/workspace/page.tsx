"use client";

import { useState } from "react";
import { Save, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const INPUT =
  "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors placeholder:text-muted-foreground";
const SELECT =
  "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors";
const LABEL = "block text-xs font-medium text-foreground mb-1.5";
const SAVE_BTN =
  "flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const LANGUAGES = [
  { value: "en", label: "English (US)" },
  { value: "en-gb", label: "English (UK)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese (Simplified)" },
];

export default function WorkspacePage() {
  const { toast } = useToast();
  const [bizName, setBizName] = useState("My Workspace");
  const [timezone, setTimezone] = useState("America/New_York");
  const [language, setLanguage] = useState("en");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your workspace identity, timezone, and defaults.
        </p>
      </div>

      {/* Identity */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Identity</h2>

        {/* Logo */}
        <div>
          <p className={LABEL}>Workspace logo</p>
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-white select-none">
                {bizName.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors">
              <Upload className="size-3.5" /> Upload logo
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="ws-bizname" className={LABEL}>
            Business name
          </label>
          <input
            id="ws-bizname"
            className={INPUT}
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="Your company name"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={() =>
              toast({ message: "Identity saved.", variant: "success" })
            }
            className={SAVE_BTN}
          >
            <Save className="size-3.5" /> Save
          </button>
        </div>
      </section>

      {/* Regional */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">
          Regional defaults
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ws-timezone" className={LABEL}>
              Timezone
            </label>
            <select
              id="ws-timezone"
              className={SELECT}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ws-language" className={LABEL}>
              Default language
            </label>
            <select
              id="ws-language"
              className={SELECT}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() =>
              toast({ message: "Regional settings saved.", variant: "success" })
            }
            className={SAVE_BTN}
          >
            <Save className="size-3.5" /> Save
          </button>
        </div>
      </section>
    </div>
  );
}
