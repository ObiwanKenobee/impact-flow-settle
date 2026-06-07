import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { verifyProof, type ProofVerificationResult, type SignedBundleProof } from "@/lib/settlement-contract";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Atlas Sanctum — Verify Signed Bundle Proof" },
      {
        name: "description",
        content:
          "Upload a signed settlement bundle proof to re-verify its hash chain, per-event signatures, key fingerprints, and determinism end-to-end.",
      },
      { property: "og:title", content: "Atlas Sanctum — Proof Verification" },
      {
        property: "og:description",
        content:
          "Independent verifier for atlas.sanctum.proof.v1 bundles: chain integrity, signature validity, key fingerprint match, and determinism mismatch report.",
      },
    ],
  }),
  component: VerifyPage,
});

type State =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "ok"; proof: SignedBundleProof; result: ProofVerificationResult; fileName: string };

function VerifyPage() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text) as SignedBundleProof;
      const result = verifyProof(json);
      setState({ kind: "ok", proof: json, result, fileName: file.name });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
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
            <Link to="/" className="hover:text-foreground">Infrastructure</Link>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/verify" className="text-foreground">Verify</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-20">
        <header className="mb-12">
          <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">Compliance · Proof Verifier</span>
          <h1 className="text-5xl md:text-6xl font-display font-extrabold tracking-tight mt-6 mb-6 text-balance">
            Verify a signed bundle proof.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Upload an <span className="font-mono text-foreground">atlas.sanctum.proof.v1</span> JSON file.
            The verifier independently re-derives every event's signature from the trusted key registry,
            walks the hash chain end-to-end, and reports any determinism mismatch — without trusting the
            proof's own embedded verification block.
          </p>
        </header>

        <label
          htmlFor="proof-file"
          className="block border-2 border-dashed border-border bg-card p-12 text-center cursor-pointer hover:border-accent transition-colors"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Drop or select</div>
          <div className="font-display font-bold text-2xl mt-3">Signed bundle proof (.json)</div>
          <div className="font-mono text-[10px] text-muted-foreground mt-2">
            Format: atlas.sanctum.proof.v1
          </div>
          <input
            id="proof-file"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>

        {state.kind === "error" && (
          <div className="mt-8 border border-destructive/40 bg-card p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-destructive">Could not parse</div>
            <div className="font-mono text-xs mt-2 break-all">{state.message}</div>
          </div>
        )}

        {state.kind === "ok" && <Report fileName={state.fileName} proof={state.proof} result={state.result} />}
      </main>
    </div>
  );
}

function Report({ fileName, proof, result }: { fileName: string; proof: SignedBundleProof; result: ProofVerificationResult }) {
  const headline = !result.formatOk
    ? { label: "Invalid format", tone: "destructive" as const }
    : result.ok
      ? { label: "Verified", tone: "accent" as const }
      : { label: "Mismatch detected", tone: "destructive" as const };

  return (
    <div className="mt-12 space-y-8">
      {/* Headline */}
      <div className={`border ${headline.tone === "accent" ? "border-accent" : "border-destructive/60"} bg-card p-8`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{fileName}</div>
            <div className="font-display font-extrabold text-3xl mt-1">Bundle {proof.bundleId}</div>
          </div>
          <div
            className={`font-mono text-xs uppercase tracking-widest px-4 py-2 ${
              headline.tone === "accent" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {headline.label}
          </div>
        </div>

        <dl className="grid sm:grid-cols-3 gap-4 mt-8 font-mono text-[11px]">
          <KV k="Investor" v={proof.investor} />
          <KV k="Project" v={proof.project} />
          <KV k="Outcome ID" v={proof.outcomeId} />
          <KV k="FX pair" v={proof.fxPair} />
          <KV k="Rate" v={String(proof.rate)} />
          <KV k="Rail" v={proof.rail} />
        </dl>
      </div>

      {/* Chain status */}
      <Card title="Hash chain integrity">
        <Row
          label="Chain linkage"
          ok={result.chainOk}
          detail={
            result.chainOk
              ? "All prevHash links resolve in sequence."
              : `Broken at event #${(result.brokenAt ?? 0) + 1} · ${result.brokenReason ?? "unknown"}`
          }
        />
        <Row label="Format" ok={result.formatOk} detail="atlas.sanctum.proof.v1" />
      </Card>

      {/* Signatures */}
      <Card title="Per-event signature verification">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-muted-foreground uppercase tracking-widest text-[10px] border-b border-border">
                <th className="text-left py-2 pr-3">#</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">Signer</th>
                <th className="text-left py-2 pr-3">Key fingerprint</th>
                <th className="text-left py-2 pr-3">Signature</th>
                <th className="text-left py-2 pr-3">prevHash</th>
              </tr>
            </thead>
            <tbody>
              {result.eventResults.map((r) => (
                <tr key={r.seq} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3 tabular-nums">{r.seq}</td>
                  <td className="py-2 pr-3 uppercase">{r.type}</td>
                  <td className="py-2 pr-3">{r.signer}</td>
                  <td className="py-2 pr-3">
                    <Pill ok={r.fingerprintOk}>{r.providedFingerprint}</Pill>
                    {!r.fingerprintOk && (
                      <div className="text-muted-foreground mt-1 normal-case">expected {r.expectedFingerprint}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Pill ok={r.sigOk}>{r.sigOk ? "valid" : "invalid"}</Pill>
                  </td>
                  <td className="py-2 pr-3">
                    <Pill ok={r.prevHashOk}>{r.prevHashOk ? "linked" : "broken"}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Determinism */}
      <Card title="Determinism — recorded vs re-derived">
        {result.determinismMismatches.length === 0 ? (
          <Row ok detail="All deterministic fields (rate, rail, amount out) match the recorded inputs." label="No mismatches" />
        ) : (
          <div className="space-y-2 font-mono text-[11px]">
            {result.determinismMismatches.map((m) => (
              <div key={m.field} className="flex items-center justify-between border border-destructive/40 px-3 py-2">
                <span className="uppercase tracking-widest text-[10px] text-muted-foreground">{m.field}</span>
                <span>
                  expected <span className="text-foreground">{String(m.expected)}</span> · got{" "}
                  <span className="text-destructive">{String(m.actual)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/60 last:border-b-0">
      <div>
        <div className="font-display font-bold">{label}</div>
        <div className="font-mono text-[11px] text-muted-foreground mt-1">{detail}</div>
      </div>
      <Pill ok={ok}>{ok ? "OK" : "FAIL"}</Pill>
    </div>
  );
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
        ok ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"
      }`}
    >
      {children}
    </span>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted-foreground uppercase tracking-widest text-[10px]">{k}</dt>
      <dd className="text-foreground mt-1 break-all">{v}</dd>
    </div>
  );
}
