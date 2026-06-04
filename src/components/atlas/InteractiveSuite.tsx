import { useEffect, useMemo, useRef, useState } from "react";

/* ============================================================
   Shared primitives
   ============================================================ */

function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-12 max-w-3xl">
      <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">{kicker}</span>
      <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mt-4 text-balance">
        {title}
      </h2>
      {sub ? (
        <p className="text-muted-foreground mt-4 leading-relaxed max-w-2xl">{sub}</p>
      ) : null}
    </div>
  );
}

function Panel({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-border bg-card ${className}`}>
      {label ? (
        <div className="px-5 py-3 border-b border-border font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Stat({ k, v, mono = true }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-border last:border-0">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</span>
      <span className={`${mono ? "font-mono" : ""} text-sm text-foreground`}>{v}</span>
    </div>
  );
}

/* ============================================================
   1. Interactive Settlement Simulator (EUR → KES)
   ============================================================ */

type OutcomeKind = "trees" | "hectares" | "water";

const OUTCOME_CATALOG: Record<
  OutcomeKind,
  { label: string; unit: string; pricePerUnitEUR: number; co2PerUnit: number; symbol: string }
> = {
  trees: { label: "Reforestation", unit: "trees", pricePerUnitEUR: 4, co2PerUnit: 0.021, symbol: "TREE" },
  hectares: { label: "Forest Protection", unit: "hectares", pricePerUnitEUR: 120, co2PerUnit: 4.6, symbol: "HECT" },
  water: { label: "Water Wells", unit: "wells", pricePerUnitEUR: 850, co2PerUnit: 0, symbol: "AQUA" },
};

// indicative FX EUR -> KES
const EUR_KES = 142.6;
const FX_SPREAD = 0.004;

export function SettlementSimulator({
  onCommit,
}: {
  onCommit: (event: SimulatorCommit) => void;
}) {
  const [eur, setEur] = useState<number>(25000);
  const [kind, setKind] = useState<OutcomeKind>("trees");
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [running, setRunning] = useState(false);

  const cat = OUTCOME_CATALOG[kind];
  const kes = useMemo(() => eur * EUR_KES * (1 - FX_SPREAD), [eur]);
  const units = useMemo(() => Math.floor(eur / cat.pricePerUnitEUR), [eur, cat]);
  const co2 = useMemo(() => +(units * cat.co2PerUnit).toFixed(2), [units, cat]);

  function run() {
    if (running) return;
    setRunning(true);
    setStep(0);
    const seq: Array<0 | 1 | 2 | 3 | 4> = [1, 2, 3, 4];
    seq.forEach((s, i) => {
      window.setTimeout(() => setStep(s), 650 * (i + 1));
    });
    window.setTimeout(() => {
      setRunning(false);
      onCommit({
        eur,
        kes,
        kind,
        units,
        co2,
        ts: new Date().toISOString(),
      });
    }, 650 * (seq.length + 1));
  }

  return (
    <Panel label="Settlement Simulator / EUR → KES → Outcome" className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Inputs */}
        <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-border space-y-6">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Capital In (EUR)
              </label>
              <span className="font-display text-2xl font-bold tabular-nums">
                €{eur.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={500000}
              step={1000}
              value={eur}
              onChange={(e) => setEur(parseInt(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>€1k</span>
              <span>€500k</span>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Outcome Asset
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(OUTCOME_CATALOG) as OutcomeKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`px-3 py-3 border text-left transition-colors cursor-pointer ${
                    kind === k
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    {OUTCOME_CATALOG[k].symbol}
                  </div>
                  <div className="text-xs font-semibold mt-1">{OUTCOME_CATALOG[k].label}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={run}
            disabled={running}
            className="w-full px-4 py-3 bg-foreground text-background font-mono text-[11px] tracking-widest uppercase hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            {running ? "Routing…" : "Run Settlement"}
          </button>
        </div>

        {/* Flow visualization */}
        <div className="lg:col-span-7 p-6 bg-stone-tint/40">
          <div className="grid grid-cols-4 gap-3 mb-6">
            {["FX", "ROUTE", "VERIFY", "MINT"].map((lbl, i) => (
              <div
                key={lbl}
                className={`h-1 transition-colors ${
                  step > i ? "bg-accent" : "bg-border"
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FlowNode
              active={step >= 1}
              k="01 — FX Conversion"
              big={`€${eur.toLocaleString()}`}
              small={`→ KES ${kes.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              meta={`rate ${EUR_KES} · spread ${(FX_SPREAD * 100).toFixed(2)}%`}
            />
            <FlowNode
              active={step >= 2}
              k="02 — Routed"
              big="Nairobi Node"
              small="Atlas Liquidity Pool"
              meta="latency 1.4s"
            />
            <FlowNode
              active={step >= 3}
              k="03 — IoT Verified"
              big="Signed"
              small={`${units.toLocaleString()} ${cat.unit}`}
              meta="oracle quorum 4/5"
            />
            <FlowNode
              active={step >= 4}
              k={`04 — ${cat.symbol} Minted`}
              big={`${units.toLocaleString()}`}
              small={`${co2} t CO₂e`}
              meta={`asset id pending…`}
              accent
            />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 font-mono text-[11px]">
            <div className="p-3 border border-border bg-card">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Settled</div>
              <div className="text-foreground mt-1">KES {kes.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="p-3 border border-border bg-card">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Units</div>
              <div className="text-foreground mt-1">{units.toLocaleString()} {cat.unit}</div>
            </div>
            <div className="p-3 border border-accent/40 bg-accent/5">
              <div className="text-[9px] uppercase tracking-widest text-accent">CO₂e</div>
              <div className="text-foreground mt-1">{co2} t</div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FlowNode({
  k,
  big,
  small,
  meta,
  active,
  accent,
}: {
  k: string;
  big: string;
  small: string;
  meta: string;
  active: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-4 border bg-card transition-all duration-500 ${
        active
          ? accent
            ? "border-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_12%,transparent)]"
            : "border-foreground/30"
          : "border-border opacity-40"
      }`}
    >
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="font-display text-xl font-bold mt-2 tabular-nums">{big}</div>
      <div className="text-xs text-muted-foreground">{small}</div>
      <div className="font-mono text-[10px] text-muted-foreground/70 mt-2">{meta}</div>
    </div>
  );
}

export type SimulatorCommit = {
  eur: number;
  kes: number;
  kind: OutcomeKind;
  units: number;
  co2: number;
  ts: string;
};

/* ============================================================
   2. Outcome Registry — unique digital identities
   ============================================================ */

export type RegistryEntry = {
  id: string;
  kind: OutcomeKind;
  units: number;
  co2: number;
  geo: string;
  hash: string;
  ts: string;
};

const GEOS = ["KE-001 Mau Forest", "KE-014 Tana Delta", "ET-022 Bale Mtns", "RW-007 Volcanoes NP", "TZ-031 Kilombero"];

function makeHash(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `0x${hex}${(Math.random().toString(16).slice(2, 10))}`;
}

export function OutcomeRegistry({
  entries,
  onMint,
}: {
  entries: RegistryEntry[];
  onMint: (e: RegistryEntry) => void;
}) {
  const [kind, setKind] = useState<OutcomeKind>("trees");
  const [units, setUnits] = useState<number>(50);
  const [geo, setGeo] = useState(GEOS[0]);

  function mint() {
    const cat = OUTCOME_CATALOG[kind];
    const id = `${cat.symbol}-${(entries.length + 1).toString().padStart(4, "0")}`;
    const ts = new Date().toISOString();
    const e: RegistryEntry = {
      id,
      kind,
      units,
      co2: +(units * cat.co2PerUnit).toFixed(2),
      geo,
      hash: makeHash(id + ts + geo),
      ts,
    };
    onMint(e);
  }

  return (
    <Panel label="Outcome Registry / Verified Digital Identities">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Mint form */}
        <div className="lg:col-span-4 p-6 border-b lg:border-b-0 lg:border-r border-border space-y-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Outcome Type
            </div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as OutcomeKind)}
              className="w-full px-3 py-2 border border-border bg-card font-mono text-xs"
            >
              {(Object.keys(OUTCOME_CATALOG) as OutcomeKind[]).map((k) => (
                <option key={k} value={k}>
                  {OUTCOME_CATALOG[k].symbol} — {OUTCOME_CATALOG[k].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Units ({OUTCOME_CATALOG[kind].unit})
              </span>
              <span className="font-display text-lg font-bold tabular-nums">{units}</span>
            </div>
            <input
              type="range"
              min={1}
              max={1000}
              value={units}
              onChange={(e) => setUnits(parseInt(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Geo Beacon
            </div>
            <select
              value={geo}
              onChange={(e) => setGeo(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-card font-mono text-xs"
            >
              {GEOS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          <button
            onClick={mint}
            className="w-full px-4 py-3 bg-accent text-accent-foreground font-mono text-[11px] tracking-widest uppercase hover:brightness-110 transition-all cursor-pointer"
          >
            Mint Digital Identity
          </button>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Each outcome receives an immutable identifier — a verifiable record that connects
            real-world impact to its on-chain asset.
          </p>
        </div>

        {/* Registry list */}
        <div className="lg:col-span-8 p-0">
          <div className="px-6 py-3 grid grid-cols-12 gap-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground border-b border-border bg-stone-tint/40">
            <div className="col-span-3">Asset ID</div>
            <div className="col-span-3">Geo</div>
            <div className="col-span-2">Units</div>
            <div className="col-span-2">CO₂e (t)</div>
            <div className="col-span-2">Hash</div>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                Registry empty — mint the first verified outcome.
              </div>
            ) : (
              entries
                .slice()
                .reverse()
                .map((e) => (
                  <div
                    key={e.id}
                    className="px-6 py-3 grid grid-cols-12 gap-3 items-center text-xs font-mono hover:bg-stone-tint/40 transition-colors"
                  >
                    <div className="col-span-3 flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-accent" />
                      <span className="text-foreground">{e.id}</span>
                    </div>
                    <div className="col-span-3 text-muted-foreground truncate">{e.geo}</div>
                    <div className="col-span-2 tabular-nums">{e.units}</div>
                    <div className="col-span-2 tabular-nums text-accent">{e.co2}</div>
                    <div className="col-span-2 text-muted-foreground truncate" title={e.hash}>
                      {e.hash.slice(0, 10)}…
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================
   3. Investor Funding Flow — stepwise visualization
   ============================================================ */

const FUNDING_STEPS = [
  {
    k: "Capital Commitment",
    body: "Investor commits EUR via institutional on-ramp. Funds escrowed to Atlas custody.",
    side: "Tier-1 custody · ISO 27001",
  },
  {
    k: "Settlement Routing",
    body: "FX engine quotes EUR/KES and routes via lowest-slippage corridor.",
    side: "Latency 1.4s · Spread 0.4%",
  },
  {
    k: "Outcome Verification",
    body: "IoT oracles + field auditors sign-off. Quorum threshold triggers fund release.",
    side: "Oracle quorum 4/5",
  },
  {
    k: "Asset Mint",
    body: "Verified outcome minted as digital identity. Bound 1:1 to physical reality.",
    side: "Atlas Registry",
  },
  {
    k: "Return Distribution",
    body: "Yield + carbon credits atomically distributed to investor wallet & project operators.",
    side: "Atomic · t+0",
  },
] as const;

export function InvestorFlow({ onAudit }: { onAudit: (entry: AuditEntry) => void }) {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const completed = step >= FUNDING_STEPS.length;
  const timer = useRef<number | null>(null);

  function reset() {
    if (timer.current) window.clearTimeout(timer.current);
    setStep(0);
    setRunning(false);
  }

  function play() {
    if (running) return;
    setRunning(true);
    setStep(0);
    const tick = (i: number) => {
      if (i > FUNDING_STEPS.length) {
        setRunning(false);
        return;
      }
      setStep(i);
      if (i > 0) {
        const s = FUNDING_STEPS[i - 1];
        onAudit({
          ts: new Date().toISOString(),
          actor: ["Investor", "FX Engine", "Oracle Network", "Atlas Registry", "Settlement Engine"][i - 1],
          event: s.k,
          signal: ["committed", "routed", "verified", "minted", "settled"][i - 1],
          ref: `evt_${Math.random().toString(36).slice(2, 8)}`,
        });
      }
      timer.current = window.setTimeout(() => tick(i + 1), 1100);
    };
    tick(1);
  }

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <Panel label="Investor Funding Flow / End-to-end Settlement">
      <div className="p-6 border-b border-border flex items-center justify-between gap-4">
        <div className="font-mono text-[11px] text-muted-foreground">
          Step <span className="text-foreground">{Math.min(step, FUNDING_STEPS.length)}</span> / {FUNDING_STEPS.length}
          {completed ? <span className="ml-3 text-accent">● Settlement complete</span> : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-3 py-2 border border-border font-mono text-[10px] uppercase tracking-widest hover:bg-stone-tint cursor-pointer"
          >
            Reset
          </button>
          <button
            onClick={play}
            disabled={running}
            className="px-4 py-2 bg-foreground text-background font-mono text-[10px] uppercase tracking-widest hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            {running ? "Running…" : completed ? "Replay" : "Play"}
          </button>
        </div>
      </div>

      <ol className="divide-y divide-border">
        {FUNDING_STEPS.map((s, i) => {
          const active = step === i + 1;
          const done = step > i + 1 || (completed && step >= i + 1);
          return (
            <li
              key={s.k}
              className={`grid grid-cols-12 gap-4 px-6 py-5 transition-colors ${
                active ? "bg-accent/5" : done ? "bg-stone-tint/30" : ""
              }`}
            >
              <div className="col-span-1 flex items-start">
                <div
                  className={`size-8 grid place-items-center border font-mono text-[11px] tabular-nums ${
                    done
                      ? "bg-foreground text-background border-foreground"
                      : active
                      ? "border-accent text-accent"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
              <div className="col-span-8">
                <div className="font-display font-bold">{s.k}</div>
                <div className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">{s.body}</div>
              </div>
              <div className="col-span-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right self-center">
                {s.side}
                {active ? <div className="mt-1 text-accent">● live</div> : null}
                {done && !active ? <div className="mt-1 text-foreground">● done</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ============================================================
   4. Audit Trail
   ============================================================ */

export type AuditEntry = {
  ts: string;
  actor: string;
  event: string;
  signal: string;
  ref: string;
};

export function AuditTrail({
  entries,
  fxLog,
  onClear,
}: {
  entries: AuditEntry[];
  fxLog: SimulatorCommit[];
  onClear: () => void;
}) {
  const merged = useMemo(() => {
    const fxAsAudit: AuditEntry[] = fxLog.map((f, i) => ({
      ts: f.ts,
      actor: "FX Engine",
      event: `EUR→KES · ${f.eur.toLocaleString()} → ${Math.round(f.kes).toLocaleString()}`,
      signal: `${OUTCOME_CATALOG[f.kind].symbol} ×${f.units}`,
      ref: `fx_${i.toString().padStart(4, "0")}`,
    }));
    return [...entries, ...fxAsAudit].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [entries, fxLog]);

  return (
    <Panel label="Audit Trail / Settlement Events">
      <div className="px-6 py-3 flex justify-between items-center border-b border-border bg-stone-tint/40">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {merged.length} event{merged.length === 1 ? "" : "s"} recorded
        </div>
        <button
          onClick={onClear}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Clear log
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3 px-6 py-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground border-b border-border">
        <div className="col-span-3">Timestamp</div>
        <div className="col-span-2">Actor</div>
        <div className="col-span-4">Event</div>
        <div className="col-span-2">Signal</div>
        <div className="col-span-1 text-right">Ref</div>
      </div>

      <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
        {merged.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground font-mono">
            No settlement activity yet. Run the simulator or investor flow.
          </div>
        ) : (
          merged.map((e) => (
            <div
              key={e.ref + e.ts}
              className="px-6 py-3 grid grid-cols-12 gap-3 items-center text-xs font-mono hover:bg-stone-tint/40 transition-colors"
            >
              <div className="col-span-3 text-muted-foreground">
                {new Date(e.ts).toLocaleTimeString()}{" "}
                <span className="text-foreground/40">
                  {new Date(e.ts).toLocaleDateString()}
                </span>
              </div>
              <div className="col-span-2 text-foreground">{e.actor}</div>
              <div className="col-span-4 text-muted-foreground truncate" title={e.event}>
                {e.event}
              </div>
              <div className="col-span-2 text-accent">{e.signal}</div>
              <div className="col-span-1 text-right text-muted-foreground truncate" title={e.ref}>
                {e.ref}
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/* ============================================================
   Composite: orchestrates state across the suite
   ============================================================ */

export function InteractiveSuite() {
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [fxLog, setFxLog] = useState<SimulatorCommit[]>([]);

  return (
    <div className="space-y-12">
      <div>
        <SectionHeader
          kicker="Interactive · Live Engine"
          title="Settlement Simulator."
          sub="Move European capital into Kenyan outcome assets. Watch FX, routing, verification, and asset mint resolve in real time."
        />
        <SettlementSimulator
          onCommit={(c) => {
            setFxLog((p) => [...p, c]);
            const cat = OUTCOME_CATALOG[c.kind];
            const id = `${cat.symbol}-${(registry.length + 1).toString().padStart(4, "0")}`;
            const e: RegistryEntry = {
              id,
              kind: c.kind,
              units: c.units,
              co2: c.co2,
              geo: GEOS[Math.floor(Math.random() * GEOS.length)],
              hash: makeHash(id + c.ts),
              ts: c.ts,
            };
            setRegistry((p) => [...p, e]);
            setAudit((p) => [
              ...p,
              {
                ts: c.ts,
                actor: "Atlas Registry",
                event: `Minted ${cat.symbol} · ${c.units} ${cat.unit}`,
                signal: `${c.co2} t CO₂e`,
                ref: id,
              },
            ]);
          }}
        />
      </div>

      <div>
        <SectionHeader
          kicker="Registry · On-chain Identity"
          title="Every outcome, a unique digital identity."
          sub="Each verified hectare, tree, or water well receives a cryptographic identity that binds real-world impact to a tradable, settleable asset."
        />
        <OutcomeRegistry
          entries={registry}
          onMint={(e) => {
            setRegistry((p) => [...p, e]);
            setAudit((p) => [
              ...p,
              {
                ts: e.ts,
                actor: "Atlas Registry",
                event: `Minted ${e.id} · ${e.geo}`,
                signal: e.hash.slice(0, 10),
                ref: e.id,
              },
            ]);
          }}
        />
      </div>

      <div>
        <SectionHeader
          kicker="Investor Journey"
          title="Capital → Verification → Yield."
          sub="The full lifecycle of an Atlas-routed investment. Funding, FX, verified outcome release, and atomic return distribution."
        />
        <InvestorFlow onAudit={(a) => setAudit((p) => [...p, a])} />
      </div>

      <div>
        <SectionHeader
          kicker="Provenance"
          title="Auditable by design."
          sub="Every intermediary, FX conversion, timestamp, and verification signal lands here. Immutable, exportable, regulator-ready."
        />
        <AuditTrail entries={audit} fxLog={fxLog} onClear={() => { setAudit([]); setFxLog([]); }} />
      </div>
    </div>
  );
}
