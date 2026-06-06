import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  contract,
  OUTCOME_CATALOG,
  FX_RATES,
  FX_RAILS,
  FX_PAIRS,
  INVESTORS,
  PROJECTS,
  ALL_ACTORS,
  VIEWER_PROFILES,
  isAuthorizedFor,
  verifyChain,
  replayBundle,
  determinismReport,
  buildSignedBundleProof,
  keyFingerprint,
  type OutcomeKind,
  type SettlementBundle,
  type SettlementEvent,
  type SettlementEventType,
  type ViewerPermissions,
} from "@/lib/settlement-contract";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

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
      {sub ? <p className="text-muted-foreground mt-4 leading-relaxed max-w-2xl">{sub}</p> : null}
    </div>
  );
}

function Panel({
  label, children, className = "",
}: { label?: string; children: React.ReactNode; className?: string }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      {children}
    </label>
  );
}

function fmtTs(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleTimeString(undefined, { hour12: false })} · ${d.toLocaleDateString()}`;
}

const STEP_LABEL: Record<SettlementEventType, string> = {
  fx: "FX Conversion",
  route: "Routing",
  verify: "Verification",
  mint: "Outcome Mint",
  distribute: "Return Distribution",
};

/* ============================================================
   Contract subscription
   ============================================================ */

function useContractEvents() {
  const [events, setEvents] = useState<SettlementEvent[]>(contract.getEvents());
  const [bundles, setBundles] = useState<SettlementBundle[]>(contract.getBundles());
  useEffect(() => {
    const u1 = contract.subscribe(() => setEvents(contract.getEvents()));
    const u2 = contract.subscribeBundle(() => setBundles(contract.getBundles()));
    return () => { u1(); u2(); };
  }, []);
  return { events, bundles };
}

/* ============================================================
   Permission gate banner
   ============================================================ */

function PermissionBar({
  viewer, setViewer, profiles,
}: { viewer: ViewerPermissions; setViewer: (v: ViewerPermissions) => void; profiles: ViewerPermissions[] }) {
  const scope =
    viewer.investors.length === 0 && viewer.projects.length === 0 && (!viewer.actors || viewer.actors.length === 0)
      ? "Unrestricted"
      : [
          ...(viewer.investors.length ? [`inv: ${viewer.investors.join(", ")}`] : []),
          ...(viewer.projects.length ? [`prj: ${viewer.projects.join(", ")}`] : []),
          ...(viewer.actors && viewer.actors.length ? [`act: ${viewer.actors.join(", ")}`] : []),
        ].join(" · ");
  return (
    <Panel label="Viewer Identity & Permission Scope">
      <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-5">
          <Field label="Active session">
            <select
              value={viewer.label}
              onChange={(e) => {
                const v = profiles.find((p) => p.label === e.target.value);
                if (v) setViewer(v);
              }}
              className="w-full px-3 py-2 border border-border bg-card font-mono text-xs"
            >
              {profiles.map((p) => <option key={p.label}>{p.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-7 font-mono text-[11px] text-muted-foreground">
          <div className="text-accent uppercase tracking-widest text-[10px] mb-1">Authorized scope</div>
          {scope} — audit events, exports, and intermediary visibility are restricted to this scope.
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================
   Settlement Simulator
   ============================================================ */

function SettlementSimulator() {
  const [investor, setInvestor] = useState(INVESTORS[0]);
  const [project, setProject] = useState(PROJECTS[0]);
  const [fxPair, setFxPair] = useState(FX_PAIRS[0]);
  const [eur, setEur] = useState(25000);
  const [kind, setKind] = useState<OutcomeKind>("trees");
  const [realtime, setRealtime] = useState(true);
  const [delay, setDelay] = useState(700);
  const [feeBps, setFeeBps] = useState(40);
  const [activeStep, setActiveStep] = useState<SettlementEventType | null>(null);
  const [running, setRunning] = useState(false);
  const [lastBundle, setLastBundle] = useState<SettlementBundle | null>(null);

  const cat = OUTCOME_CATALOG[kind];
  const rate = FX_RATES[fxPair];
  const rail = FX_RAILS[fxPair];
  const [from, to] = fxPair.split("/");
  const fee = eur * (feeBps / 10000);
  const out = (eur - fee) * rate;
  const units = Math.floor(eur / cat.pricePerUnitEUR);
  const co2 = +(units * cat.co2PerUnit).toFixed(2);

  async function run() {
    if (running) return;
    setRunning(true);
    setActiveStep(null);
    const bundle = await contract.settle({
      investor, project, fxPair, amountIn: eur, feeBps, kind,
      onStep: realtime
        ? async (type) => { setActiveStep(type); await new Promise((r) => setTimeout(r, delay)); }
        : undefined,
    });
    setLastBundle(bundle);
    setActiveStep("distribute");
    setRunning(false);
  }

  const stepOrder: SettlementEventType[] = ["fx", "route", "verify", "mint", "distribute"];
  const stepIdx = activeStep ? stepOrder.indexOf(activeStep) : -1;

  return (
    <Panel label="Settlement Simulator / Live Engine" className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-border space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Investor">
              <select value={investor} onChange={(e) => setInvestor(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-card font-mono text-xs">
                {INVESTORS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Project">
              <select value={project} onChange={(e) => setProject(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-card font-mono text-xs">
                {PROJECTS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="FX Pair / Rail">
              <select value={fxPair} onChange={(e) => setFxPair(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-card font-mono text-xs">
                {FX_PAIRS.map((x) => <option key={x}>{x} · {FX_RAILS[x].node}</option>)}
              </select>
            </Field>
            <Field label="Outcome Template">
              <select value={kind} onChange={(e) => setKind(e.target.value as OutcomeKind)}
                className="w-full px-3 py-2 border border-border bg-card font-mono text-xs">
                {(Object.keys(OUTCOME_CATALOG) as OutcomeKind[]).map((k) => (
                  <option key={k} value={k}>{OUTCOME_CATALOG[k].symbol} · {OUTCOME_CATALOG[k].label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="border border-border bg-stone-tint/40 p-3 font-mono text-[10px] text-muted-foreground">
            <div className="text-accent uppercase tracking-widest mb-1">Rail · {rail.corridor}</div>
            node {rail.node} · ~{rail.latencyMs}ms · oracle {cat.template.oracleNetwork} · quorum {cat.template.quorum}
            <div className="mt-1">template fields: {cat.template.metadataFields.join(", ")}</div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Capital In ({from})
              </span>
              <span className="font-display text-xl font-bold tabular-nums">{eur.toLocaleString()}</span>
            </div>
            <input type="range" min={1000} max={500000} step={1000}
              value={eur} onChange={(e) => setEur(parseInt(e.target.value))}
              className="w-full accent-[var(--accent)]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Fee</span>
                <span className="font-mono text-xs tabular-nums">{(feeBps / 100).toFixed(2)}%</span>
              </div>
              <input type="range" min={0} max={200} value={feeBps}
                onChange={(e) => setFeeBps(parseInt(e.target.value))}
                className="w-full accent-[var(--accent)]" />
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Step delay</span>
                <span className="font-mono text-xs tabular-nums">{delay}ms</span>
              </div>
              <input type="range" min={100} max={2000} step={50}
                value={delay} onChange={(e) => setDelay(parseInt(e.target.value))}
                disabled={!realtime}
                className="w-full accent-[var(--accent)] disabled:opacity-40" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={realtime}
              onChange={(e) => setRealtime(e.target.checked)}
              className="accent-[var(--accent)]" />
            <span className="font-mono text-[11px] uppercase tracking-widest">Real-time mode</span>
          </label>

          <button onClick={run} disabled={running}
            className="w-full px-4 py-3 bg-foreground text-background font-mono text-[11px] tracking-widest uppercase hover:bg-accent transition-colors cursor-pointer disabled:opacity-50">
            {running ? "Settling…" : "Execute Settlement"}
          </button>
        </div>

        <div className="lg:col-span-7 p-6 bg-stone-tint/40">
          <div className="grid grid-cols-5 gap-2 mb-6">
            {stepOrder.map((s, i) => (
              <div key={s} className={`h-1 transition-colors ${stepIdx >= i ? "bg-accent" : "bg-border"}`} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FlowNode active={stepIdx >= 0} k={`01 — FX ${fxPair}`} big={`${eur.toLocaleString()}`} small={`→ ${Math.round(out).toLocaleString()} ${to}`} meta={`rate ${rate} · fee ${fee.toFixed(0)}`} />
            <FlowNode active={stepIdx >= 1} k={`02 — Route ${rail.node}`} big={from + "→" + to} small={rail.corridor} meta={`latency ${rail.latencyMs}ms`} />
            <FlowNode active={stepIdx >= 2} k="03 — Verify" big={cat.template.oracleNetwork} small={`quorum ${cat.template.quorum}`} meta={cat.template.signalLabels[0]} />
            <FlowNode active={stepIdx >= 3} k={`04 — Mint ${cat.symbol}`} big={`${units.toLocaleString()}`} small={`${co2} t CO₂e`} meta={lastBundle?.outcomeId ?? "pending…"} accent />
            <FlowNode active={stepIdx >= 4} k="05 — Distribute" big={`${Math.round(out * 0.07).toLocaleString()}`} small={`${to} yield`} meta="atomic · t+0" />
            <FlowNode active={!!lastBundle} k="Bundle" big={lastBundle?.bundleId.slice(0, 10) ?? "—"} small={lastBundle ? "Sealed & signed" : "Awaiting run"} meta={lastBundle ? `${lastBundle.events.length} events` : "—"} />
          </div>

          {lastBundle ? (
            <div className="mt-6 p-4 border border-accent/30 bg-card">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-accent">Settlement bundle</div>
                  <div className="font-mono text-xs mt-1">{lastBundle.bundleId} → outcome {lastBundle.outcomeId}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportBundleCSV(lastBundle)}
                    className="px-3 py-2 border border-border font-mono text-[10px] uppercase tracking-widest hover:bg-stone-tint cursor-pointer">
                    Export CSV
                  </button>
                  <button onClick={() => exportBundlePDF(lastBundle)}
                    className="px-3 py-2 bg-accent text-accent-foreground font-mono text-[10px] uppercase tracking-widest hover:brightness-110 cursor-pointer">
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function FlowNode({
  k, big, small, meta, active, accent,
}: { k: string; big: string; small: string; meta: string; active: boolean; accent?: boolean }) {
  return (
    <div className={`p-4 border bg-card transition-all duration-500 ${
      active
        ? accent
          ? "border-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_12%,transparent)]"
          : "border-foreground/30"
        : "border-border opacity-40"
    }`}>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="font-display text-lg font-bold mt-2 tabular-nums truncate" title={big}>{big}</div>
      <div className="text-xs text-muted-foreground truncate">{small}</div>
      <div className="font-mono text-[10px] text-muted-foreground/70 mt-2 truncate" title={meta}>{meta}</div>
    </div>
  );
}

/* ============================================================
   Outcome Registry
   ============================================================ */

function OutcomeRegistry({ bundles, viewer }: { bundles: SettlementBundle[]; viewer: ViewerPermissions }) {
  const visible = bundles.filter((b) => isAuthorizedFor(viewer, b));
  return (
    <Panel label="Outcome Registry / Verified Digital Identities">
      <div className="grid grid-cols-12 gap-3 px-6 py-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground border-b border-border bg-stone-tint/40">
        <div className="col-span-2">Asset ID</div>
        <div className="col-span-3">Project</div>
        <div className="col-span-2">Template</div>
        <div className="col-span-1">Units</div>
        <div className="col-span-1">CO₂e</div>
        <div className="col-span-3">Template Metadata</div>
      </div>
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground font-mono">
            {bundles.length === 0
              ? "Run the simulator — each verified outcome mints a unique identity here."
              : "No outcomes visible under current permission scope."}
          </div>
        ) : (
          [...visible].reverse().map((b) => (
            <div key={b.bundleId} className="px-6 py-3 grid grid-cols-12 gap-3 items-start text-xs font-mono hover:bg-stone-tint/40 transition-colors">
              <div className="col-span-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="text-foreground">{b.outcomeId}</span>
              </div>
              <div className="col-span-3 text-muted-foreground truncate">{b.project}</div>
              <div className="col-span-2 text-muted-foreground">{OUTCOME_CATALOG[b.kind].label}</div>
              <div className="col-span-1 tabular-nums">{b.units}</div>
              <div className="col-span-1 tabular-nums text-accent">{b.co2}</div>
              <div className="col-span-3 text-muted-foreground/90 text-[10px] leading-relaxed">
                {Object.entries(b.metadata).map(([k, v]) => (
                  <div key={k} className="truncate"><span className="text-foreground">{k}</span>: {String(v)}</div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/* ============================================================
   Investor Funding Flow
   ============================================================ */

const FUNDING_STEPS: { type: SettlementEventType; k: string; body: string; side: string }[] = [
  { type: "fx", k: "Capital Commitment & FX", body: "Investor commits capital; FX engine quotes rate and applies fee.", side: "Tier-1 custody" },
  { type: "route", k: "Settlement Routing", body: "Per-pair liquidity rail selected (Pesalink, SWIFT, CLS) and funds routed in-country.", side: "Per-rail latency" },
  { type: "verify", k: "Outcome Verification", body: "Template-specific oracles (NDVI, LiDAR, flow-meter) sign off. Quorum triggers release.", side: "Oracle quorum" },
  { type: "mint", k: "Asset Mint", body: "Verified outcome minted as a unique digital identity with template metadata.", side: "Atlas Registry" },
  { type: "distribute", k: "Return Distribution", body: "Yield + credits distributed atomically to investor and operators.", side: "Atomic · t+0" },
];

function InvestorFlow({ events, viewer }: { events: SettlementEvent[]; viewer: ViewerPermissions }) {
  const scoped = events.filter((e) => isAuthorizedFor(viewer, e));
  const latestByType = useMemo(() => {
    const m: Partial<Record<SettlementEventType, SettlementEvent>> = {};
    for (const e of scoped) m[e.type] = e;
    return m;
  }, [scoped]);

  return (
    <Panel label="Investor Funding Flow / Lifecycle">
      <ol className="divide-y divide-border">
        {FUNDING_STEPS.map((s, i) => {
          const evt = latestByType[s.type];
          const done = !!evt;
          return (
            <li key={s.k} className={`grid grid-cols-12 gap-4 px-6 py-5 transition-colors ${done ? "bg-stone-tint/30" : ""}`}>
              <div className="col-span-1">
                <div className={`size-8 grid place-items-center border font-mono text-[11px] tabular-nums ${
                  done ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                }`}>
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
              <div className="col-span-7">
                <div className="font-display font-bold">{s.k}</div>
                <div className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">{s.body}</div>
                {evt ? (
                  <div className="font-mono text-[10px] text-muted-foreground/80 mt-2 truncate" title={evt.id}>
                    last event {evt.id.slice(0, 14)}… · {fmtTs(evt.ts)}
                  </div>
                ) : null}
              </div>
              <div className="col-span-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right self-center">
                {s.side}
                {done ? <div className="mt-1 text-accent">● recorded</div> : <div className="mt-1">awaiting</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ============================================================
   Event Replay View
   ============================================================ */

function ReplayView({ bundles, viewer }: { bundles: SettlementBundle[]; viewer: ViewerPermissions }) {
  const visible = bundles.filter((b) => isAuthorizedFor(viewer, b));
  const [selected, setSelected] = useState<string>("");
  const [playIdx, setPlayIdx] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);

  useEffect(() => {
    if (visible.length && !visible.find((b) => b.bundleId === selected)) {
      setSelected(visible[visible.length - 1].bundleId);
      setPlayIdx(-1);
    }
  }, [visible, selected]);

  const bundle = visible.find((b) => b.bundleId === selected);
  const replay = bundle ? replayBundle(bundle) : null;
  const chain = bundle ? verifyChain(bundle.events) : null;

  async function play() {
    if (!bundle || playing) return;
    setPlaying(true);
    for (let i = 0; i < bundle.events.length; i++) {
      setPlayIdx(i);
      await new Promise((r) => setTimeout(r, speed));
    }
    setPlaying(false);
  }

  return (
    <Panel label="Event Replay / Determinism Verifier">
      <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end border-b border-border">
        <div className="md:col-span-5">
          <Field label="Recorded bundle">
            <select value={selected} onChange={(e) => { setSelected(e.target.value); setPlayIdx(-1); }}
              className="w-full px-3 py-2 border border-border bg-card font-mono text-xs">
              {visible.length === 0 && <option value="">— none in scope —</option>}
              {visible.map((b) => (
                <option key={b.bundleId} value={b.bundleId}>
                  {b.bundleId} · {b.outcomeId} · {b.investor} / {b.project}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="md:col-span-3">
          <Field label={`Step interval ${speed}ms`}>
            <input type="range" min={100} max={1500} step={50} value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="w-full accent-[var(--accent)]" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <button onClick={play} disabled={!bundle || playing}
            className="w-full px-4 py-2 bg-foreground text-background font-mono text-[11px] tracking-widest uppercase hover:bg-accent transition-colors cursor-pointer disabled:opacity-50">
            {playing ? "Replaying…" : "Replay"}
          </button>
        </div>
        <div className="md:col-span-2 text-right">
          {chain && (
            <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${
              chain.ok ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"
            }`}>
              {chain.ok ? "● chain valid" : `● broken @${chain.brokenAt}`}
            </span>
          )}
        </div>
      </div>

      {bundle && replay ? (
        <div className="divide-y divide-border max-h-[440px] overflow-y-auto">
          {replay.steps.map((s) => {
            const ok = s.sigMatches && s.prevHashMatches;
            const active = playIdx >= s.index;
            return (
              <div key={s.original.id}
                className={`grid grid-cols-12 gap-3 px-6 py-3 font-mono text-[11px] transition-all ${
                  active ? "bg-stone-tint/40" : "opacity-50"
                }`}>
                <div className="col-span-1 text-muted-foreground">{String(s.index + 1).padStart(2, "0")}</div>
                <div className="col-span-2 uppercase tracking-widest text-foreground">{STEP_LABEL[s.type]}</div>
                <div className="col-span-3 truncate text-muted-foreground" title={s.original.id}>
                  id {s.original.id.slice(0, 14)}…
                </div>
                <div className="col-span-3 truncate text-muted-foreground" title={s.original.sig}>
                  sig {s.original.sig.slice(0, 14)}…
                </div>
                <div className="col-span-3 text-right">
                  <Badge ok={s.sigMatches} label="sig" />
                  <Badge ok={s.prevHashMatches} label="link" />
                  <Badge ok={ok} label={ok ? "deterministic" : "drift"} />
                </div>
              </div>
            );
          })}
          <div className="px-6 py-3 font-mono text-[10px] text-muted-foreground">
            replayed {replay.steps.length} events · prevHash chain {chain?.ok ? "intact" : "broken"} · signer keys verified locally
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-muted-foreground font-mono">
          Run a settlement to record a replayable bundle.
        </div>
      )}
    </Panel>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-block ml-1 px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${
      ok ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"
    }`}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

/* ============================================================
   Audit Trail
   ============================================================ */

const ALL = "__all__";

function AuditTrail({
  events, bundles, viewer, onClear, onShowEvent,
}: {
  events: SettlementEvent[];
  bundles: SettlementBundle[];
  viewer: ViewerPermissions;
  onClear: () => void;
  onShowEvent: (e: SettlementEvent) => void;
}) {
  const [q, setQ] = useState("");
  const [investor, setInvestor] = useState<string>(ALL);
  const [project, setProject] = useState<string>(ALL);
  const [actor, setActor] = useState<string>(ALL);
  const [fxPair, setFxPair] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);

  const scoped = useMemo(() => events.filter((e) => isAuthorizedFor(viewer, e)), [events, viewer]);
  const actors = useMemo(() => Array.from(new Set(scoped.map((e) => e.actor))).sort(), [scoped]);
  const pairs = useMemo(() => Array.from(new Set(scoped.map((e) => e.fxPair).filter(Boolean))) as string[], [scoped]);

  // chain verification is computed against the full chain; per-row marks the event's own pair
  const chain = useMemo(() => verifyChain(events), [events]);
  const eventOkById = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const prevOk = i === 0 || e.prevHash === events[i - 1].id;
      if (prevOk) set.add(e.id);
    }
    return set;
  }, [events]);

  const filtered = useMemo(() => {
    return scoped
      .filter((e) =>
        (investor === ALL || e.investor === investor) &&
        (project === ALL || e.project === project) &&
        (actor === ALL || e.actor === actor) &&
        (fxPair === ALL || e.fxPair === fxPair) &&
        (type === ALL || e.type === type) &&
        (q === "" ||
          [e.id, e.signal, e.investor, e.project, e.actor, e.fxPair ?? "", e.sig, JSON.stringify(e.payload)]
            .join(" ").toLowerCase().includes(q.toLowerCase())))
      .slice()
      .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [scoped, q, investor, project, actor, fxPair, type]);

  return (
    <Panel label="Audit Trail / Settlement Events">
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-6 gap-2 border-b border-border bg-stone-tint/30">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search id, signal, signature…"
          className="md:col-span-2 px-3 py-2 border border-border bg-card font-mono text-xs" />
        <FilterSelect label="Investor" value={investor} onChange={setInvestor} options={INVESTORS} />
        <FilterSelect label="Project" value={project} onChange={setProject} options={PROJECTS} />
        <FilterSelect label="Intermediary" value={actor} onChange={setActor} options={actors} />
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect label="FX" value={fxPair} onChange={setFxPair} options={pairs} />
          <FilterSelect label="Signal" value={type} onChange={setType}
            options={Object.keys(STEP_LABEL)}
            renderOption={(o) => STEP_LABEL[o as SettlementEventType] ?? o} />
        </div>
      </div>

      <div className="px-6 py-3 flex justify-between items-center border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {filtered.length} / {scoped.length} scoped · {events.length} total · {bundles.length} bundle{bundles.length === 1 ? "" : "s"}
          <span className={`ml-3 px-1.5 py-0.5 ${chain.ok ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
            chain {chain.ok ? "✓ valid" : `✗ broken @${chain.brokenAt}`}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportEventsCSV(filtered)}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground cursor-pointer">
            Export filtered CSV
          </button>
          <button onClick={onClear}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive cursor-pointer">
            Clear log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 px-6 py-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground border-b border-border">
        <div className="col-span-2">Timestamp</div>
        <div className="col-span-1">Type</div>
        <div className="col-span-2">Actor · Signer</div>
        <div className="col-span-2">Investor</div>
        <div className="col-span-2">Project</div>
        <div className="col-span-1">FX</div>
        <div className="col-span-2 text-right">Signal · Sig</div>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground font-mono">
            No matching events under current permissions.
          </div>
        ) : (
          filtered.map((e) => {
            const ok = eventOkById.has(e.id);
            return (
              <div key={e.id} className="px-6 py-3 grid grid-cols-12 gap-3 items-center text-xs font-mono hover:bg-stone-tint/40 transition-colors">
                <div className="col-span-2 text-muted-foreground">{fmtTs(e.ts)}</div>
                <div className="col-span-1">
                  <span className="px-1.5 py-0.5 bg-stone-tint text-[9px] uppercase tracking-widest text-foreground">{e.type}</span>
                </div>
                <div className="col-span-2 text-foreground truncate" title={`${e.actor} · ${e.signer}`}>
                  {e.actor}
                  <div className="text-[9px] text-muted-foreground/70">signer {e.signer}</div>
                </div>
                <div className="col-span-2 text-muted-foreground truncate">{e.investor}</div>
                <div className="col-span-2 text-muted-foreground truncate">{e.project}</div>
                <div className="col-span-1 text-muted-foreground">{e.fxPair ?? "—"}</div>
                <div className="col-span-2 text-right truncate">
                  <span className="text-accent">{e.signal}</span>
                  <div className="text-[9px] text-muted-foreground/70 truncate" title={e.sig}>
                    {e.sig.slice(0, 14)}… <span className={ok ? "text-accent" : "text-destructive"}>{ok ? "✓" : "✗"}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

function FilterSelect({
  label, value, onChange, options, renderOption,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; renderOption?: (o: string) => string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="px-2 py-2 border border-border bg-card font-mono text-[11px]" aria-label={label}>
      <option value={ALL}>{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>{renderOption ? renderOption(o) : o}</option>
      ))}
    </select>
  );
}

/* ============================================================
   Exporters
   ============================================================ */

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function eventsToCSV(events: SettlementEvent[]) {
  const headers = ["ts", "bundleId", "type", "actor", "signer", "investor", "project", "fxPair", "signal", "id", "prevHash", "sig", "payload"];
  const rows = events.map((e) =>
    [e.ts, e.bundleId, e.type, e.actor, e.signer, e.investor, e.project, e.fxPair ?? "", e.signal, e.id, e.prevHash, e.sig, JSON.stringify(e.payload)]
      .map(csvEscape).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function exportEventsCSV(events: SettlementEvent[]) {
  download(`atlas-audit-${Date.now()}.csv`, new Blob([eventsToCSV(events)], { type: "text/csv" }));
}

function exportBundleCSV(b: SettlementBundle) {
  const meta = [
    `# Atlas Sanctum Settlement Bundle`,
    `# Bundle: ${b.bundleId}`,
    `# Outcome ID: ${b.outcomeId}`,
    `# Investor: ${b.investor}`,
    `# Project: ${b.project}`,
    `# FX: ${b.fxPair} @ ${b.rate}  Rail: ${b.rail}`,
    `# Amount In: ${b.amountIn}  Amount Out: ${b.amountOut.toFixed(2)}  Fee (bps): ${b.feeBps}`,
    `# Units: ${b.units} ${OUTCOME_CATALOG[b.kind].unit}  CO2e: ${b.co2} t`,
    `# Template metadata: ${JSON.stringify(b.metadata)}`,
    "",
  ].join("\n");
  download(`atlas-bundle-${b.bundleId}.csv`, new Blob([meta + eventsToCSV(b.events)], { type: "text/csv" }));
}

function exportBundlePDF(b: SettlementBundle) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Atlas Sanctum — Settlement Bundle", M, y); y += 22;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text(`Generated ${new Date().toISOString()}`, M, y); y += 18;
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 18;

  const cat = OUTCOME_CATALOG[b.kind];
  const rows: [string, string][] = [
    ["Bundle ID", b.bundleId],
    ["Outcome ID", b.outcomeId],
    ["Investor", b.investor],
    ["Project", b.project],
    ["FX Pair / Rail", `${b.fxPair} @ ${b.rate} · ${b.rail}`],
    ["Amount In", `${b.amountIn.toLocaleString()} ${b.fxPair.split("/")[0]}`],
    ["Amount Out", `${b.amountOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${b.fxPair.split("/")[1]}`],
    ["Fee (bps)", String(b.feeBps)],
    ["Outcome", `${cat.label} · ${b.units} ${cat.unit}`],
    ["CO2e", `${b.co2} t`],
    ["Created", fmtTs(b.createdAt)],
  ];
  doc.setTextColor(20); doc.setFontSize(10);
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold"); doc.text(k, M, y);
    doc.setFont("helvetica", "normal"); doc.text(v, M + 140, y); y += 16;
  }

  y += 6; doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Template Metadata", M, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  for (const [k, v] of Object.entries(b.metadata)) {
    doc.text(`${k}: ${String(v)}`, M, y); y += 12;
  }

  y += 6; doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Event Chain (hash-linked, signed)", M, y); y += 16;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  b.events.forEach((e, i) => {
    if (y > 740) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.text(`${String(i + 1).padStart(2, "0")} · ${STEP_LABEL[e.type]}`, M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(120);
    doc.text(fmtTs(e.ts), W - M, y, { align: "right" }); doc.setTextColor(20); y += 13;
    doc.text(`actor: ${e.actor}   signer: ${e.signer}   signal: ${e.signal}`, M, y); y += 12;
    doc.setTextColor(120);
    doc.text(`hash: ${e.id}`, M, y); y += 11;
    doc.text(`prev: ${e.prevHash}`, M, y); y += 11;
    doc.text(`sig : ${e.sig}`, M, y); y += 11;
    const payload = Object.entries(e.payload).map(([k, v]) => `${k}=${v}`).join("  ");
    if (payload) {
      const wrapped = doc.splitTextToSize(payload, W - 2 * M);
      doc.text(wrapped, M, y); y += wrapped.length * 11;
    }
    doc.setTextColor(20); y += 6;
  });

  doc.setFontSize(8); doc.setTextColor(150);
  doc.text("Atlas Sanctum · Compliance & Investor Report · permission-scoped export",
    M, doc.internal.pageSize.getHeight() - 24);

  doc.save(`atlas-bundle-${b.bundleId}.pdf`);
}

/* ============================================================
   Composite
   ============================================================ */

export function InteractiveSuite() {
  const { events, bundles } = useContractEvents();
  const [viewer, setViewer] = useState<ViewerPermissions>(VIEWER_PROFILES[0]);

  return (
    <div className="space-y-12">
      <div>
        <SectionHeader
          kicker="Access · Counterparty Scope"
          title="Permissioned by counterparty."
          sub="Choose the viewing identity. Audit events, the registry, and exported reports are restricted to the investors and projects this session is authorized for."
        />
        <PermissionBar viewer={viewer} setViewer={setViewer} />
      </div>

      <div>
        <SectionHeader
          kicker="Interactive · Live Engine"
          title="Settlement Simulator."
          sub="Drive a settlement across multiple FX pairs and rails (EUR/KES Pesalink, USD/KES SWIFT, EUR/USD CLS). Real-time mode animates each step; outcome templates select the oracle network and registry metadata."
        />
        <SettlementSimulator />
      </div>

      <div>
        <SectionHeader
          kicker="Registry · On-chain Identity"
          title="Every outcome, a unique digital identity."
          sub="Each verified hectare, tree, or water well becomes a unique asset minted with template-specific metadata — species and survival for trees, biome and biodiversity index for hectares, flow yield and aquifer for water."
        />
        <OutcomeRegistry bundles={bundles} viewer={viewer} />
      </div>

      <div>
        <SectionHeader
          kicker="Investor Journey"
          title="Capital → Verification → Yield."
          sub="The lifecycle of an Atlas-routed investment, scoped to the events this viewer is authorized to see."
        />
        <InvestorFlow events={events} viewer={viewer} />
      </div>

      <div>
        <SectionHeader
          kicker="Determinism · Replay"
          title="Re-run any bundle, byte-for-byte."
          sub="Replay a recorded settlement step-by-step. Each event's signature is re-derived from its signer key and the previous hash; chain linkage is verified end-to-end."
        />
        <ReplayView bundles={bundles} viewer={viewer} />
      </div>

      <div>
        <SectionHeader
          kicker="Provenance"
          title="Auditable by design."
          sub="Every intermediary, signer, FX pair, timestamp, and verification signal — filterable, hash-chained, and digitally signed. Exports respect counterparty permissions."
        />
        <AuditTrail
          events={events}
          bundles={bundles}
          viewer={viewer}
          onClear={() => contract.clear()}
        />
      </div>
    </div>
  );
}
