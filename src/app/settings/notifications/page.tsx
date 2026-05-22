"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";

const SAVE_BTN =
  "flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function NotificationsPage() {
  const { toast } = useToast();

  const [emailFailed, setEmailFailed] = useState(true);
  const [emailSummary, setEmailSummary] = useState(true);
  const [emailWeekly, setEmailWeekly] = useState(false);
  const [emailMissed, setEmailMissed] = useState(true);

  const [smsFailed, setSmsFailed] = useState(false);
  const [smsMissed, setSmsMissed] = useState(false);

  const [inAppAll, setInAppAll] = useState(true);
  const [inAppMentions, setInAppMentions] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how and when you receive alerts about your agents.
        </p>
      </div>

      {/* Email */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-1">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Email notifications
        </h2>
        <ToggleRow
          label="Failed calls"
          description="Get notified immediately when a call fails or errors out."
          checked={emailFailed}
          onChange={setEmailFailed}
        />
        <ToggleRow
          label="Missed calls"
          description="Alert when an inbound call goes unanswered."
          checked={emailMissed}
          onChange={setEmailMissed}
        />
        <ToggleRow
          label="Daily summary"
          description="A morning digest of yesterday's call activity."
          checked={emailSummary}
          onChange={setEmailSummary}
        />
        <ToggleRow
          label="Weekly report"
          description="Performance trends and highlights delivered every Monday."
          checked={emailWeekly}
          onChange={setEmailWeekly}
        />
        <div className="flex justify-end pt-3">
          <button
            onClick={() =>
              toast({ message: "Email preferences saved.", variant: "success" })
            }
            className={SAVE_BTN}
          >
            <Save className="size-3.5" /> Save
          </button>
        </div>
      </section>

      {/* SMS */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-1">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          SMS notifications
        </h2>
        <ToggleRow
          label="Failed calls"
          description="Receive a text message when a call fails."
          checked={smsFailed}
          onChange={setSmsFailed}
        />
        <ToggleRow
          label="Missed calls"
          description="Get a text when an inbound call goes unanswered."
          checked={smsMissed}
          onChange={setSmsMissed}
        />
        <div className="flex justify-end pt-3">
          <button
            onClick={() =>
              toast({ message: "SMS preferences saved.", variant: "success" })
            }
            className={SAVE_BTN}
          >
            <Save className="size-3.5" /> Save
          </button>
        </div>
      </section>

      {/* In-app */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-1">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          In-app notifications
        </h2>
        <ToggleRow
          label="All activity"
          description="Show in-app banners for calls, errors, and status changes."
          checked={inAppAll}
          onChange={setInAppAll}
        />
        <ToggleRow
          label="Mentions & assignments"
          description="Notify when a team member mentions or assigns you."
          checked={inAppMentions}
          onChange={setInAppMentions}
        />
        <div className="flex justify-end pt-3">
          <button
            onClick={() =>
              toast({
                message: "In-app preferences saved.",
                variant: "success",
              })
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
