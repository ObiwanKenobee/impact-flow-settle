/**
 * Mock Settlement Smart Contract
 * ------------------------------------------------------------------
 * Browser-side state machine that mimics an on-chain settlement
 * contract. Records FX conversions, outcome verifications, asset
 * mints, and return distributions as immutable, hash-linked events.
 *
 * No network calls — this is illustrative infrastructure for the
 * Atlas Sanctum interactive brief.
 */

export type OutcomeKind = "trees" | "hectares" | "water";

export interface OutcomeCatalogEntry {
  label: string;
  unit: string;
  pricePerUnitEUR: number;
  co2PerUnit: number;
  symbol: string;
}

export const OUTCOME_CATALOG: Record<OutcomeKind, OutcomeCatalogEntry> = {
  trees: { label: "Reforestation", unit: "trees", pricePerUnitEUR: 4, co2PerUnit: 0.021, symbol: "TREE" },
  hectares: { label: "Forest Protection", unit: "hectares", pricePerUnitEUR: 120, co2PerUnit: 4.6, symbol: "HECT" },
  water: { label: "Water Wells", unit: "wells", pricePerUnitEUR: 850, co2PerUnit: 0, symbol: "AQUA" },
};

export const FX_RATES: Record<string, number> = {
  "EUR/KES": 142.6,
  "USD/KES": 129.4,
  "GBP/KES": 167.1,
};

export type SettlementEventType =
  | "fx"
  | "route"
  | "verify"
  | "mint"
  | "distribute";

export interface SettlementEvent {
  id: string;          // event hash
  bundleId: string;    // groups events from one settlement
  ts: string;          // ISO timestamp
  type: SettlementEventType;
  actor: string;       // intermediary / system
  investor: string;
  project: string;
  fxPair?: string;
  signal: string;
  payload: Record<string, string | number>;
  prevHash: string;    // chain link
}

export interface SettlementBundle {
  bundleId: string;
  investor: string;
  project: string;
  fxPair: string;
  amountIn: number;
  amountOut: number;
  feeBps: number;
  kind: OutcomeKind;
  units: number;
  co2: number;
  outcomeId: string;
  events: SettlementEvent[];
  createdAt: string;
}

// -------- hashing (illustrative, not cryptographic) --------
function djb2(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function makeHash(input: string, salt: string) {
  return `0x${djb2(input + salt)}${djb2(salt + input)}`;
}

// -------- contract --------
type Subscriber = (e: SettlementEvent) => void;

class SettlementContract {
  private events: SettlementEvent[] = [];
  private bundles: SettlementBundle[] = [];
  private subs: Set<Subscriber> = new Set();
  private bundleSubs: Set<(b: SettlementBundle) => void> = new Set();
  private seq = 0;

  private lastHash(): string {
    return this.events.length === 0 ? "0x0" : this.events[this.events.length - 1].id;
  }

  subscribe(cb: Subscriber) {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  subscribeBundle(cb: (b: SettlementBundle) => void) {
    this.bundleSubs.add(cb);
    return () => this.bundleSubs.delete(cb);
  }

  getEvents(): SettlementEvent[] {
    return [...this.events];
  }

  getBundles(): SettlementBundle[] {
    return [...this.bundles];
  }

  clear() {
    this.events = [];
    this.bundles = [];
    this.seq = 0;
    this.subs.forEach((s) => s({} as SettlementEvent)); // signal clear via empty
  }

  private emit(
    bundleId: string,
    type: SettlementEventType,
    args: {
      actor: string;
      investor: string;
      project: string;
      signal: string;
      payload?: Record<string, string | number>;
      fxPair?: string;
      ts?: string;
    },
  ): SettlementEvent {
    this.seq += 1;
    const ts = args.ts ?? new Date().toISOString();
    const prevHash = this.lastHash();
    const evt: SettlementEvent = {
      id: makeHash(`${bundleId}|${type}|${this.seq}|${ts}`, prevHash),
      bundleId,
      ts,
      type,
      actor: args.actor,
      investor: args.investor,
      project: args.project,
      fxPair: args.fxPair,
      signal: args.signal,
      payload: args.payload ?? {},
      prevHash,
    };
    this.events.push(evt);
    this.subs.forEach((s) => s(evt));
    return evt;
  }

  /**
   * Execute the full settlement lifecycle. If `onStep` is provided,
   * callers can await between phases to drive real-time animation.
   */
  async settle(input: {
    investor: string;
    project: string;
    fxPair: string;
    amountIn: number;
    feeBps: number;
    kind: OutcomeKind;
    onStep?: (type: SettlementEventType, evt: SettlementEvent) => Promise<void> | void;
  }): Promise<SettlementBundle> {
    const { investor, project, fxPair, amountIn, feeBps, kind, onStep } = input;
    const cat = OUTCOME_CATALOG[kind];
    const rate = FX_RATES[fxPair] ?? FX_RATES["EUR/KES"];
    const fee = amountIn * (feeBps / 10000);
    const amountOut = (amountIn - fee) * rate;

    const bundleId = `bdl_${djb2(`${investor}${project}${Date.now()}${this.seq}`)}`;

    // 01 FX
    const fxEvt = this.emit(bundleId, "fx", {
      actor: "FX Engine",
      investor,
      project,
      fxPair,
      signal: `rate ${rate}`,
      payload: { amountIn, fee, amountOut, rate, feeBps },
    });
    await onStep?.("fx", fxEvt);

    // 02 Route
    const routeEvt = this.emit(bundleId, "route", {
      actor: "Nairobi Liquidity Node",
      investor,
      project,
      fxPair,
      signal: "routed",
      payload: { node: "NBO-01", latencyMs: 1400 },
    });
    await onStep?.("route", routeEvt);

    // 03 Verify
    const verifyEvt = this.emit(bundleId, "verify", {
      actor: "Oracle Network",
      investor,
      project,
      signal: "quorum 4/5",
      payload: { kind, oracles: 5, attestations: 4 },
    });
    await onStep?.("verify", verifyEvt);

    // 04 Mint outcome digital identity (linked to verify event)
    const units = Math.floor(amountIn / cat.pricePerUnitEUR);
    const co2 = +(units * cat.co2PerUnit).toFixed(2);
    const outcomeId = `${cat.symbol}-${(this.bundles.length + 1).toString().padStart(4, "0")}`;
    const mintEvt = this.emit(bundleId, "mint", {
      actor: "Atlas Registry",
      investor,
      project,
      signal: outcomeId,
      payload: { units, co2, kind, linkedVerify: verifyEvt.id },
    });
    await onStep?.("mint", mintEvt);

    // 05 Distribute returns
    const distEvt = this.emit(bundleId, "distribute", {
      actor: "Settlement Engine",
      investor,
      project,
      fxPair,
      signal: "atomic t+0",
      payload: { yieldKES: Math.round(amountOut * 0.07), credits: co2 },
    });
    await onStep?.("distribute", distEvt);

    const bundle: SettlementBundle = {
      bundleId,
      investor,
      project,
      fxPair,
      amountIn,
      amountOut,
      feeBps,
      kind,
      units,
      co2,
      outcomeId,
      events: [fxEvt, routeEvt, verifyEvt, mintEvt, distEvt],
      createdAt: fxEvt.ts,
    };
    this.bundles.push(bundle);
    this.bundleSubs.forEach((s) => s(bundle));
    return bundle;
  }
}

export const contract = new SettlementContract();

// Investor / project rosters for the demo
export const INVESTORS = [
  "Helix Capital",
  "Nordic Climate Fund",
  "Sovereign Green Trust",
  "Aurora Pension",
];
export const PROJECTS = [
  "KE-001 Mau Forest",
  "KE-014 Tana Delta",
  "ET-022 Bale Mtns",
  "RW-007 Volcanoes NP",
  "TZ-031 Kilombero",
];
export const FX_PAIRS = Object.keys(FX_RATES);
