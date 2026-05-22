"use client";

import { useState } from "react";
import { Zap, CheckCircle, Download, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const INVOICES = [
  {
    id: "INV-2026-005",
    date: "May 1, 2026",
    amount: "$149.00",
    status: "paid",
  },
  {
    id: "INV-2026-004",
    date: "Apr 1, 2026",
    amount: "$149.00",
    status: "paid",
  },
  { id: "INV-2026-003", date: "Mar 1, 2026", amount: "$99.00", status: "paid" },
];

const PRO_FEATURES = [
  "Up to 10 AI agents",
  "5,000 minutes / month",
  "Call transcripts & summaries",
  "Call history (12 months)",
  "Team collaboration (5 seats)",
  "Email & SMS notifications",
  "API access",
  "Priority support",
];

export default function BillingPage() {
  const { toast } = useToast();
  const [showCardForm, setShowCardForm] = useState(false);
  const usedMinutes = 2_340;
  const totalMinutes = 5_000;
  const pct = Math.round((usedMinutes / totalMinutes) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your plan, usage, and payment details.
        </p>
      </div>

      {/* Plan card */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                <Zap className="size-3" /> Pro
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              $149{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / month
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Renews on June 1, 2026 · Billed monthly
            </p>
          </div>
          <button
            onClick={() =>
              toast({
                message: "Redirecting to upgrade flow…",
                variant: "info",
              })
            }
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shrink-0"
          >
            Upgrade plan
          </button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 pt-1">
          {PRO_FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2 text-xs text-foreground"
            >
              <CheckCircle className="size-3.5 text-success shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* Usage */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          Usage this month
        </h2>

        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Minutes used</span>
            <span className="font-medium text-foreground">
              {usedMinutes.toLocaleString()} / {totalMinutes.toLocaleString()}{" "}
              min
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct >= 90
                  ? "bg-destructive"
                  : pct >= 70
                    ? "bg-warning"
                    : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {pct}% of monthly allowance used
          </p>
        </div>
      </section>

      {/* Payment method */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Payment method
          </h2>
          <button
            onClick={() => setShowCardForm((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showCardForm ? "Cancel" : "Update"}
          </button>
        </div>

        {!showCardForm ? (
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
              <CreditCard className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Visa ending in 4242
              </p>
              <p className="text-xs text-muted-foreground">Expires 08/2027</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="billing-card-num"
                className="block text-xs font-medium text-foreground mb-1.5"
              >
                Card number
              </label>
              <input
                id="billing-card-num"
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors"
                placeholder="1234 5678 9012 3456"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="billing-expiry"
                  className="block text-xs font-medium text-foreground mb-1.5"
                >
                  Expiry
                </label>
                <input
                  id="billing-expiry"
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors"
                  placeholder="MM / YY"
                />
              </div>
              <div>
                <label
                  htmlFor="billing-cvc"
                  className="block text-xs font-medium text-foreground mb-1.5"
                >
                  CVC
                </label>
                <input
                  id="billing-cvc"
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors"
                  placeholder="•••"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowCardForm(false);
                  toast({
                    message: "Payment method updated.",
                    variant: "success",
                  });
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save card
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Invoices */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4">
                Invoice
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4">
                Date
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4">
                Amount
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground pb-2">
                Status
              </th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((inv) => (
              <tr key={inv.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 font-mono text-xs text-foreground">
                  {inv.id}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{inv.date}</td>
                <td className="py-3 pr-4 font-medium text-foreground">
                  {inv.amount}
                </td>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success text-xs font-medium rounded-full">
                    <CheckCircle className="size-3" /> Paid
                  </span>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() =>
                      toast({
                        message: `Downloading ${inv.id}…`,
                        variant: "info",
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="size-3.5" /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
