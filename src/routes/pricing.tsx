import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createCheckout } from "@/lib/checkout.functions";
import type { Tier as TierName } from "@/lib/entitlements";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Atlas Sanctum — Pricing & Access Tiers" },
      {
        name: "description",
        content:
          "Pricing for Atlas Sanctum settlement infrastructure — Operator, Institutional, and Sovereign tiers with verified outcome assets and signed bundle proofs.",
      },
      { property: "og:title", content: "Atlas Sanctum — Pricing" },
      {
        property: "og:description",
        content:
          "Choose the Atlas Sanctum tier that matches your settlement volume, verification needs, and compliance posture.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Pricing,
});

type Cycle = "monthly" | "annual";

interface Tier {
  name: string;
  kicker: string;
  monthly: number;
  annual: number;
  blurb: string;
  features: string[];
  accent?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Operator",
    kicker: "Single-project",
    monthly: 1200,
    annual: 11500,
    blurb: "For project operators settling verified outcomes on a single corridor.",
    features: [
      "Up to 250 settlement bundles / mo",
      "EUR/KES or USD/KES rail",
      "Outcome registry with template metadata",
      "PDF + CSV bundle exports",
      "Email compliance support",
    ],
  },
  {
    name: "Institutional",
    kicker: "Multi-corridor",
    monthly: 4900,
    annual: 47000,
    blurb: "For funds and DFIs running multi-pair settlement with full audit obligations.",
    features: [
      "Unlimited settlement bundles",
      "All FX corridors (EUR/USD/GBP → KES, CLS)",
      "Permissioned audit trail + signed bundle proofs",
      "Determinism reports + event replay",
      "Counterparty admin & RBAC",
      "Priority oracle quorum (5/7)",
    ],
    accent: true,
  },
  {
    name: "Sovereign",
    kicker: "Treasury-grade",
    monthly: 18500,
    annual: 178000,
    blurb: "For central banks, sovereign wealth, and global development institutions.",
    features: [
      "Dedicated liquidity node + SLA",
      "Custom FX pairs & private rails",
      "On-prem signer HSM integration",
      "Regulator-facing compliance exports",
      "Quarterly attestation review",
      "24/7 incident response",
    ],
  },
];

function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<TierName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckout);

  async function startCheckout(tier: TierName) {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email to continue.");
      return;
    }
    setPending(tier);
    try {
      const { checkoutUrl } = await checkout({ data: { tier, cycle, email } });
      // In production this is the provider's hosted URL. Here it's our own
      // success page that completes the mock webhook callback.
      navigate({ to: checkoutUrl });
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    }
  }

  return (
    <div className="bg-background text-foreground font-body min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-extrabold tracking-tighter text-xl">
            ATLAS SANCTUM
          </Link>
          <div className="hidden md:flex gap-6 text-[11px] font-mono tracking-widest uppercase text-muted-foreground">
            <Link to="/" hash="infrastructure" className="hover:text-foreground transition-colors">Infrastructure</Link>
            <Link to="/" hash="engine" className="hover:text-foreground transition-colors">Live Engine</Link>
            <Link to="/pricing" className="text-foreground">Pricing</Link>
          </div>
          <Link to="/pricing" hash="contact"
            className="px-4 py-1.5 bg-foreground text-background text-[11px] font-mono tracking-widest uppercase hover:bg-accent transition-colors">
            Connect Node
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {/* Hero */}
        <section className="pt-24 pb-16 text-center border-b border-border">
          <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">Pricing & Access</span>
          <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight mt-6 mb-8 text-balance">
            Settlement, priced by <span className="text-accent">corridor</span>.
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
            Atlas Sanctum is metered by settlement volume and verification depth — not by seats. Pick the tier that
            matches your counterparty obligations and compliance posture.
          </p>

          {/* Cycle toggle */}
          <div className="mt-10 inline-flex border border-border bg-card font-mono text-[11px] tracking-widest uppercase">
            {(["monthly", "annual"] as Cycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`px-5 py-2.5 cursor-pointer transition-colors ${
                  cycle === c ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
                {c === "annual" ? <span className="ml-2 text-accent">−20%</span> : null}
              </button>
            ))}
          </div>
        </section>

        {/* Tiers */}
        <section className="py-24 grid grid-cols-1 md:grid-cols-3 -mx-px">
          {TIERS.map((t) => {
            const price = cycle === "monthly" ? t.monthly : Math.round(t.annual / 12);
            return (
              <div
                key={t.name}
                className={`p-8 border -ml-px -mt-px flex flex-col ${
                  t.accent ? "border-accent bg-stone-tint/60" : "border-border bg-card"
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t.kicker}</div>
                <h2 className="font-display font-bold text-3xl mt-2">{t.name}</h2>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed min-h-[3rem]">{t.blurb}</p>

                <div className="mt-8 mb-6 border-t border-border pt-6">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display font-extrabold text-5xl tabular-nums">
                      €{price.toLocaleString()}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">/ month</span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">
                    {cycle === "annual" ? `Billed annually · €${t.annual.toLocaleString()}` : "Billed monthly"}
                  </div>
                </div>

                <ul className="space-y-3 text-sm flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className={`mt-1.5 size-1.5 rounded-full ${t.accent ? "bg-accent" : "bg-foreground"}`} />
                      <span className="text-muted-foreground leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => startCheckout(t.name as TierName)}
                  className={`mt-8 px-4 py-3 font-mono text-[11px] uppercase tracking-widest cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait ${
                    t.accent
                      ? "bg-accent text-accent-foreground hover:brightness-110"
                      : "bg-foreground text-background hover:bg-accent"
                  }`}
                >
                  {pending === t.name ? "Redirecting…" : `Subscribe — ${t.name}`}
                </button>
                <div className="mt-3 font-mono text-[10px] text-muted-foreground text-center">
                  Card, SEPA, or wire · 30-day pilot
                </div>
              </div>
            );
          })}
        </section>

        {/* Email capture for checkout */}
        <section className="pb-12 -mt-20">
          <div className="max-w-xl mx-auto border border-border bg-card p-6">
            <label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Billing email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@institution.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent"
            />
            <p className="font-mono text-[10px] text-muted-foreground mt-2">
              Required to provision tier access after checkout. The webhook records the purchase
              and unlocks the corresponding panels (Live Engine · Replay · Admin) immediately.
            </p>
            {error && <p className="font-mono text-[10px] text-destructive mt-2">{error}</p>}
          </div>
        </section>


        {/* Payment methods */}
        <section className="py-16 border-t border-border">
          <div className="grid md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-5">
              <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">Accepted Payment Methods</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mt-4 mb-4">
                Pay your way. Settle ours.
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                Subscriptions are processed through institutional-grade rails. Annual contracts and Sovereign tier
                are settled by SWIFT wire or SEPA direct debit; monthly plans accept card, SEPA, and ACH.
              </p>
            </div>
            <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Card", sub: "Visa · Mastercard · Amex" },
                { label: "SEPA", sub: "Direct debit · EU" },
                { label: "ACH", sub: "US bank transfer" },
                { label: "Wire", sub: "SWIFT MT103" },
                { label: "Apple Pay", sub: "Wallet checkout" },
                { label: "Google Pay", sub: "Wallet checkout" },
              ].map((m) => (
                <div key={m.label} className="p-5 border border-border bg-card">
                  <div className="font-display font-bold">{m.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compliance note */}
        <section id="contact" className="py-24 border-t border-border">
          <div className="max-w-3xl">
            <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-[0.3em]">Procurement</span>
            <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mt-4 mb-6">
              Need a custom contract?
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Sovereign deployments are negotiated directly. We provide signed bundle proofs, regulator-facing
              compliance exports, and on-prem signer HSM integrations under master services agreements.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="px-8 py-4 bg-foreground text-background font-mono text-xs tracking-widest uppercase hover:bg-accent transition-colors cursor-pointer">
                Request procurement pack
              </button>
              <Link to="/" hash="engine"
                className="px-8 py-4 border border-border font-mono text-xs tracking-widest uppercase hover:bg-stone-tint transition-colors text-center">
                See the live engine
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            © 2026 Atlas Sanctum Infrastructure Group
          </div>
          <div className="flex gap-8 font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
