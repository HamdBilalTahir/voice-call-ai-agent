"use client";

import { useState } from "react";
import { Save, Shield, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";

const INPUT =
  "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors placeholder:text-muted-foreground";
const LABEL = "block text-xs font-medium text-foreground mb-1.5";
const SAVE_BTN =
  "flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors";

export default function ProfilePage() {
  const { toast } = useToast();
  const [name, setName] = useState("Alex Johnson");
  const [email, setEmail] = useState("alex@company.com");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and security settings.
        </p>
      </div>

      {/* Personal info */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">
          Personal information
        </h2>

        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-semibold text-primary select-none">
              {name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          </div>
          <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors">
            Change photo
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-name" className={LABEL}>
              Full name
            </label>
            <input
              id="profile-name"
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="profile-email" className={LABEL}>
              Email address
            </label>
            <input
              id="profile-email"
              className={INPUT}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() =>
              toast({ message: "Profile saved.", variant: "success" })
            }
            className={SAVE_BTN}
          >
            <Save className="size-3.5" /> Save changes
          </button>
        </div>
      </section>

      {/* Password */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">
          Change password
        </h2>

        <div>
          <label htmlFor="profile-current-pw" className={LABEL}>
            Current password
          </label>
          <div className="relative">
            <input
              id="profile-current-pw"
              className={cn(INPUT, "pr-10")}
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="profile-new-pw" className={LABEL}>
            New password
          </label>
          <div className="relative">
            <input
              id="profile-new-pw"
              className={cn(INPUT, "pr-10")}
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Min 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => {
              setCurrentPw("");
              setNewPw("");
              toast({ message: "Password updated.", variant: "success" });
            }}
            className={SAVE_BTN}
          >
            <Save className="size-3.5" /> Update password
          </button>
        </div>
      </section>

      {/* MFA */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="size-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Shield className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Two-factor authentication
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add an extra layer of security with an authenticator app.
            </p>
          </div>
          <Switch
            checked={mfaEnabled}
            onCheckedChange={(v: boolean) => {
              setMfaEnabled(v);
              toast({
                message: v ? "MFA enabled." : "MFA disabled.",
                variant: v ? "success" : "info",
              });
            }}
          />
        </div>
      </section>
    </div>
  );
}
