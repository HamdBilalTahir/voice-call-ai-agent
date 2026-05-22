"use client";

import { useState } from "react";
import {
  Copy,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const MASKED_KEY = "sk_live_••••••••••••••••••••••••••••••4f2a";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected";
  logo: string;
  docsUrl: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "twilio",
    name: "Twilio",
    description:
      "SIP trunking, outbound dialing, and phone number provisioning.",
    status: "connected",
    logo: "TW",
    docsUrl: "#",
  },
  {
    id: "livekit",
    name: "LiveKit",
    description: "Real-time audio infrastructure for all agent calls.",
    status: "connected",
    logo: "LK",
    docsUrl: "#",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "LLM backbone for agent reasoning and response generation.",
    status: "connected",
    logo: "AI",
    docsUrl: "#",
  },
  {
    id: "deepgram",
    name: "Deepgram",
    description: "Streaming speech-to-text for call transcription.",
    status: "connected",
    logo: "DG",
    docsUrl: "#",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync call outcomes and contact data to your CRM.",
    status: "disconnected",
    logo: "HS",
    docsUrl: "#",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Trigger automations from call events via webhooks.",
    status: "disconnected",
    logo: "ZP",
    docsUrl: "#",
  },
];

export default function ApiPage() {
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [regenerating, setRegenerating] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText("sk_live_EXAMPLE_KEY_4f2a");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ message: "API key copied.", variant: "success" });
  }

  async function handleRegenerate() {
    setRegenerating(true);
    await new Promise((r) => setTimeout(r, 800));
    setRegenerating(false);
    toast({
      message: "API key regenerated. Update your integrations.",
      variant: "warning",
    });
  }

  function toggleIntegration(id: string) {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: i.status === "connected" ? "disconnected" : "connected",
            }
          : i,
      ),
    );
    const intg = integrations.find((i) => i.id === id);
    if (intg) {
      toast({
        message:
          intg.status === "connected"
            ? `${intg.name} disconnected.`
            : `${intg.name} connected.`,
        variant: intg.status === "connected" ? "info" : "success",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          API & Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your API credentials and third-party service connections.
        </p>
      </div>

      {/* API Key */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">API key</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use this key to authenticate requests to the Voice Call AI API. Keep
            it secret.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border font-mono text-sm text-foreground overflow-hidden">
            <span className="truncate">
              {showKey ? "sk_live_EXAMPLE_KEY_4f2a" : MASKED_KEY}
            </span>
          </div>
          <button
            onClick={() => setShowKey((v) => !v)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors whitespace-nowrap"
          >
            {showKey ? "Hide" : "Reveal"}
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              "p-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors",
              copied && "text-success border-success/30",
            )}
            title="Copy"
          >
            {copied ? (
              <CheckCircle className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-3.5", regenerating && "animate-spin")}
            />
            {regenerating ? "Regenerating…" : "Regenerate key"}
          </button>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Integrations
          </h2>
        </div>
        <div className="divide-y divide-border">
          {integrations.map((intg) => (
            <div key={intg.id} className="flex items-center gap-4 px-6 py-4">
              <div className="size-10 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-muted-foreground">
                  {intg.logo}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {intg.name}
                  </p>
                  {intg.status === "connected" ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-success">
                      <CheckCircle className="size-3" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                      <XCircle className="size-3" /> Not connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {intg.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={intg.docsUrl}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Docs"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <button
                  onClick={() => toggleIntegration(intg.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                    intg.status === "connected"
                      ? "border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
                      : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
                  )}
                >
                  {intg.status === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
