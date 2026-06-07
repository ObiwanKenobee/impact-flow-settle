import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { writeEntitlement, type Tier } from "@/lib/entitlements";
import { z } from "zod";

const search = z.object({ purchase_id: z.string().uuid().optional() });

export const Route = createFileRoute("/checkout/success")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Atlas Sanctum — Checkout Complete" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuccessPage,
});

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; tier: Tier; email: string; purchaseId: string; cycle: "monthly" | "annual" };

function SuccessPage() {
  const { purchase_id } = useSearch({ from: "/checkout/success" });
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!purchase_id) {
      setState({ kind: "error", message: "Missing purchase reference." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Simulate provider callback by posting to our own webhook.
        const webhookSecret =
          import.meta.env.VITE_CHECKOUT_WEBHOOK_SECRET ?? "dev-secret-rotate-me";
        const res = await fetch("/api/public/webhooks/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webhook-secret": webhookSecret },
          body: JSON.stringify({
            purchaseId: purchase_id,
            providerRef: `mock_${Date.now().toString(36)}`,
            status: "paid",
          }),
        });
        if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${await res.text()}`);
        const { purchase } = (await res.json()) as {
          purchase: { id: string; tier: Tier; cycle: "monthly" | "annual"; email: string };
        };
        if (cancelled) return;
        writeEntitlement({
          tier: purchase.tier,
          cycle: purchase.cycle,
          email: purchase.email,
          purchaseId: purchase.id,
          grantedAt: new Date().toISOString(),
        });
        setState({
          kind: "ok",
          tier: purchase.tier,
          email: purchase.email,
          purchaseId: purchase.id,
          cycle: purchase.cycle,
        });
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchase_id]);

  return (
    <div className="bg-background text-foreground font-body min-h-screen">
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-extrabold tracking-tighter text-xl">
            ATLAS SANCTUM
          </Link>
          <Link to="/pricing" className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground hover:text-foreground">
            Back to pricing
          </Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-24">
        {state.kind === "loading" && (
          <div className="border border-border bg-card p-10">
            <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">Settling</span>
            <h1 className="text-4xl font-display font-bold mt-4">Provisioning access…</h1>
            <p className="text-muted-foreground mt-4">Verifying payment and unlocking your tier.</p>
          </div>
        )}
        {state.kind === "error" && (
          <div className="border border-destructive/40 bg-card p-10">
            <span className="font-mono text-[10px] uppercase text-destructive tracking-[0.3em]">Checkout failed</span>
            <h1 className="text-4xl font-display font-bold mt-4">We couldn't complete provisioning.</h1>
            <p className="text-muted-foreground mt-4 font-mono text-xs">{state.message}</p>
            <Link to="/pricing" className="inline-block mt-8 px-6 py-3 bg-foreground text-background font-mono text-xs tracking-widest uppercase">
              Try again
            </Link>
          </div>
        )}
        {state.kind === "ok" && (
          <div className="border border-accent bg-card p-10">
            <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">Access granted</span>
            <h1 className="text-4xl font-display font-bold mt-4">Welcome to the {state.tier} tier.</h1>
            <p className="text-muted-foreground mt-4">
              {state.email} · {state.cycle} billing
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-4 font-mono text-[11px] uppercase tracking-widest">
              <div>
                <dt className="text-muted-foreground">Live Engine</dt>
                <dd className="text-accent mt-1">Unlocked</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Replay / Determinism</dt>
                <dd className={state.tier !== "Operator" ? "text-accent mt-1" : "text-muted-foreground mt-1"}>
                  {state.tier !== "Operator" ? "Unlocked" : "Institutional+"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Admin · Governance</dt>
                <dd className={state.tier === "Sovereign" ? "text-accent mt-1" : "text-muted-foreground mt-1"}>
                  {state.tier === "Sovereign" ? "Unlocked" : "Sovereign only"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Purchase ID</dt>
                <dd className="text-foreground mt-1 normal-case tracking-normal break-all">{state.purchaseId}</dd>
              </div>
            </dl>
            <div className="flex gap-3 mt-10">
              <Link to="/" hash="engine" className="px-6 py-3 bg-foreground text-background font-mono text-xs tracking-widest uppercase">
                Open the engine
              </Link>
              <Link to="/verify" className="px-6 py-3 border border-border font-mono text-xs tracking-widest uppercase">
                Verify a proof
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
