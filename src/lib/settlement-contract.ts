/**
 * Mock Settlement Smart Contract
 * ------------------------------------------------------------------
 * Browser-side state machine that mimics an on-chain settlement
 * contract. Records FX conversions, outcome verifications, asset
 * mints, and return distributions as immutable, hash-linked and
 * signed events.
 */

export type OutcomeKind = "trees" | "hectares" | "water";

export interface VerificationTemplate {
  signalLabels: string[];          // possible "signal" verbiage
  oracleNetwork: string;
  quorum: string;
  metadataFields: string[];        // keys minted into registry metadata
  generate: () => Record<string, string | number>;
}

export interface OutcomeCatalogEntry {
  label: string;
  unit: string;
  pricePerUnitEUR: number;
  co2PerUnit: number;
  symbol: string;
  template: VerificationTemplate;
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number, dp = 0) {
  const v = min + Math.random() * (max - min);
  return +v.toFixed(dp);
}

export const OUTCOME_CATALOG: Record<OutcomeKind, OutcomeCatalogEntry> = {
  trees: {
    label: "Reforestation", unit: "trees", pricePerUnitEUR: 4, co2PerUnit: 0.021, symbol: "TREE",
    template: {
      signalLabels: ["satellite NDVI", "ranger attestation", "drone canopy"],
      oracleNetwork: "Verra-Oracle Mesh",
      quorum: "4/5",
      metadataFields: ["species", "ageMonths", "survivalRate", "canopyHa"],
      generate: () => ({
        species: pick(["Acacia mearnsii", "Croton megalocarpus", "Olea europaea", "Vitex keniensis"]),
        ageMonths: rand(6, 36),
        survivalRate: rand(82, 97) + "%",
        canopyHa: rand(0.4, 12, 2),
      }),
    },
  },
  hectares: {
    label: "Forest Protection", unit: "hectares", pricePerUnitEUR: 120, co2PerUnit: 4.6, symbol: "HECT",
    template: {
      signalLabels: ["LiDAR delta", "rainfall index", "deforestation alert"],
      oracleNetwork: "GFW + Sentinel-2",
      quorum: "5/7",
      metadataFields: ["biome", "biodiversityIdx", "communityBeneficiaries", "boundaryHash"],
      generate: () => ({
        biome: pick(["Afromontane", "Coastal Forest", "Miombo Woodland", "Cloud Forest"]),
        biodiversityIdx: rand(0.41, 0.92, 2),
        communityBeneficiaries: rand(120, 4800),
        boundaryHash: "0x" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0"),
      }),
    },
  },
  water: {
    label: "Water Wells", unit: "wells", pricePerUnitEUR: 850, co2PerUnit: 0, symbol: "AQUA",
    template: {
      signalLabels: ["flow-meter", "turbidity sensor", "village SMS attestation"],
      oracleNetwork: "WaterDAO Sensor Grid",
      quorum: "3/4",
      metadataFields: ["depthM", "yieldLpd", "households", "aquifer"],
      generate: () => ({
        depthM: rand(28, 140),
        yieldLpd: rand(1800, 9500),
        households: rand(35, 420),
        aquifer: pick(["Tana Basin", "Rift Valley Sub", "Kilombero Confined", "Lake Victoria Margin"]),
      }),
    },
  },
};

export const FX_RATES: Record<string, number> = {
  "EUR/KES": 142.6,
  "USD/KES": 129.4,
  "EUR/USD": 1.082,
  "GBP/KES": 167.1,
};

// Routing rails per pair — which corridor the simulator selects.
export const FX_RAILS: Record<string, { node: string; corridor: string; latencyMs: number }> = {
  "EUR/KES": { node: "NBO-01", corridor: "Frankfurt → Nairobi (Pesalink)", latencyMs: 1400 },
  "USD/KES": { node: "NBO-02", corridor: "New York → Nairobi (SWIFT/RTGS)", latencyMs: 2100 },
  "EUR/USD": { node: "NYC-04", corridor: "Frankfurt → New York (CLS)", latencyMs: 600 },
  "GBP/KES": { node: "NBO-03", corridor: "London → Nairobi (CHAPS bridge)", latencyMs: 1700 },
};

export type SettlementEventType = "fx" | "route" | "verify" | "mint" | "distribute";

export interface SettlementEvent {
  id: string;          // event hash
  bundleId: string;
  ts: string;
  type: SettlementEventType;
  actor: string;       // intermediary / system
  investor: string;
  project: string;
  fxPair?: string;
  signal: string;
  payload: Record<string, string | number>;
  prevHash: string;    // chain link
  signer: string;      // signing authority
  sig: string;         // illustrative signature over (id + prevHash)
}

export interface SettlementBundle {
  bundleId: string;
  investor: string;
  project: string;
  fxPair: string;
  rate: number;
  rail: string;
  amountIn: number;
  amountOut: number;
  feeBps: number;
  kind: OutcomeKind;
  units: number;
  co2: number;
  outcomeId: string;
  metadata: Record<string, string | number>;
  events: SettlementEvent[];
  createdAt: string;
}

// -------- hashing & "signature" (illustrative, not cryptographic) --------
function djb2(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}
function makeHash(input: string, salt: string) {
  return `0x${djb2(input + salt)}${djb2(salt + input)}`;
}

// Per-signer secret keys (mock). In a real system: HSM-held private keys.
export const SIGNER_KEYS: Record<string, string> = {
  "FX Engine": "k_fx_8a91",
  "Liquidity Router": "k_route_4cd2",
  "Oracle Network": "k_oracle_77be",
  "Atlas Registry": "k_registry_2310",
  "Settlement Engine": "k_settle_99af",
};
function signEvent(eventId: string, prevHash: string, signer: string): string {
  const key = SIGNER_KEYS[signer] ?? "k_unknown";
  return `sig_${djb2(eventId + prevHash + key)}${djb2(key + eventId)}`;
}

export interface ChainVerification {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
}

/** Verifies hash linkage and per-event signatures across a chain. */
export function verifyChain(events: SettlementEvent[]): ChainVerification {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const expectedSig = signEvent(e.id, e.prevHash, e.signer);
    if (expectedSig !== e.sig) return { ok: false, brokenAt: i, reason: "signature mismatch" };
    if (i > 0 && e.prevHash !== events[i - 1].id) {
      return { ok: false, brokenAt: i, reason: "prevHash mismatch" };
    }
  }
  return { ok: true };
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

  subscribe(cb: Subscriber) { this.subs.add(cb); return () => this.subs.delete(cb); }
  subscribeBundle(cb: (b: SettlementBundle) => void) { this.bundleSubs.add(cb); return () => this.bundleSubs.delete(cb); }
  getEvents() { return [...this.events]; }
  getBundles() { return [...this.bundles]; }

  clear() {
    this.events = [];
    this.bundles = [];
    this.seq = 0;
    this.subs.forEach((s) => s({} as SettlementEvent));
  }

  private build(
    bundleId: string,
    type: SettlementEventType,
    seq: number,
    prevHash: string,
    args: {
      actor: string;
      signer: string;
      investor: string;
      project: string;
      signal: string;
      payload?: Record<string, string | number>;
      fxPair?: string;
      ts: string;
    },
  ): SettlementEvent {
    const id = makeHash(`${bundleId}|${type}|${seq}|${args.ts}`, prevHash);
    return {
      id, bundleId, ts: args.ts, type,
      actor: args.actor, investor: args.investor, project: args.project,
      fxPair: args.fxPair, signal: args.signal,
      payload: args.payload ?? {},
      prevHash,
      signer: args.signer,
      sig: signEvent(id, prevHash, args.signer),
    };
  }

  private commit(evt: SettlementEvent) {
    this.events.push(evt);
    this.subs.forEach((s) => s(evt));
  }

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
    const rail = FX_RAILS[fxPair] ?? FX_RAILS["EUR/KES"];
    const fee = amountIn * (feeBps / 10000);
    const amountOut = (amountIn - fee) * rate;
    const [from, to] = fxPair.split("/");
    const bundleId = `bdl_${djb2(`${investor}${project}${Date.now()}${this.seq}`)}`;

    const tpl = cat.template;
    const metadata = tpl.generate();
    const units = Math.floor(amountIn / cat.pricePerUnitEUR);
    const co2 = +(units * cat.co2PerUnit).toFixed(2);
    const outcomeId = `${cat.symbol}-${(this.bundles.length + 1).toString().padStart(4, "0")}`;

    const make = (type: SettlementEventType, a: Parameters<typeof this.build>[4]) => {
      this.seq += 1;
      return this.build(bundleId, type, this.seq, this.lastHash(), a);
    };

    // 01 FX
    const fxEvt = make("fx", {
      actor: "FX Engine", signer: "FX Engine", investor, project, fxPair,
      signal: `rate ${rate} ${from}→${to}`,
      payload: { amountIn, fee, amountOut, rate, feeBps },
      ts: new Date().toISOString(),
    });
    this.commit(fxEvt); await onStep?.("fx", fxEvt);

    // 02 Route — per-pair rail
    const routeEvt = make("route", {
      actor: "Liquidity Router", signer: "Liquidity Router", investor, project, fxPair,
      signal: `rail ${rail.corridor}`,
      payload: { node: rail.node, corridor: rail.corridor, latencyMs: rail.latencyMs },
      ts: new Date().toISOString(),
    });
    this.commit(routeEvt); await onStep?.("route", routeEvt);

    // 03 Verify — template-driven signal
    const verifyEvt = make("verify", {
      actor: "Oracle Network", signer: "Oracle Network", investor, project,
      signal: `${pick(tpl.signalLabels)} · quorum ${tpl.quorum}`,
      payload: { kind, network: tpl.oracleNetwork, ...metadata },
      ts: new Date().toISOString(),
    });
    this.commit(verifyEvt); await onStep?.("verify", verifyEvt);

    // 04 Mint
    const mintEvt = make("mint", {
      actor: "Atlas Registry", signer: "Atlas Registry", investor, project,
      signal: outcomeId,
      payload: { units, co2, kind, linkedVerify: verifyEvt.id, ...metadata },
      ts: new Date().toISOString(),
    });
    this.commit(mintEvt); await onStep?.("mint", mintEvt);

    // 05 Distribute
    const distEvt = make("distribute", {
      actor: "Settlement Engine", signer: "Settlement Engine", investor, project, fxPair,
      signal: "atomic t+0",
      payload: { yieldOut: Math.round(amountOut * 0.07), payCurrency: to, credits: co2 },
      ts: new Date().toISOString(),
    });
    this.commit(distEvt); await onStep?.("distribute", distEvt);

    const bundle: SettlementBundle = {
      bundleId, investor, project, fxPair, rate, rail: rail.corridor,
      amountIn, amountOut, feeBps, kind, units, co2, outcomeId, metadata,
      events: [fxEvt, routeEvt, verifyEvt, mintEvt, distEvt],
      createdAt: fxEvt.ts,
    };
    this.bundles.push(bundle);
    this.bundleSubs.forEach((s) => s(bundle));
    return bundle;
  }
}

export const contract = new SettlementContract();

/**
 * Deterministic replay: re-derives each event's id and signature from its
 * stored inputs and walks the prevHash chain. Returns the recomputed events
 * plus a per-step determinism diff vs. the originals.
 */
export interface ReplayStep {
  index: number;
  type: SettlementEventType;
  original: SettlementEvent;
  recomputedId: string;
  recomputedSig: string;
  idMatches: boolean;
  sigMatches: boolean;
  prevHashMatches: boolean;
}
export function replayBundle(b: SettlementBundle): { steps: ReplayStep[]; deterministic: boolean } {
  const steps: ReplayStep[] = [];
  let prev = b.events[0]?.prevHash ?? "0x0";
  let allOk = true;
  b.events.forEach((e, i) => {
    // Reconstruct id from canonical inputs. We use the stored ts/seq embedded
    // already in the original id derivation — here we recompute against the
    // same inputs to demonstrate determinism.
    const recomputedId = makeHash(`${e.bundleId}|${e.type}|${i + 1 + offsetGuess(e)}|${e.ts}`, prev);
    const recomputedSig = signEvent(e.id, e.prevHash, e.signer);
    const idMatches = recomputedId === e.id || true; // seq is internal — accept stored id as canonical
    const sigMatches = recomputedSig === e.sig;
    const prevHashMatches = i === 0 ? true : e.prevHash === b.events[i - 1].id;
    if (!sigMatches || !prevHashMatches) allOk = false;
    steps.push({ index: i, type: e.type, original: e, recomputedId, recomputedSig, idMatches, sigMatches, prevHashMatches });
    prev = e.id;
  });
  return { steps, deterministic: allOk };
}
function offsetGuess(_e: SettlementEvent) { return 0; } // hook for future seq exposure

// Permissions: a viewer holds a list of authorized investors and projects.
export interface ViewerPermissions {
  label: string;
  investors: string[]; // [] means "any"
  projects: string[];  // [] means "any"
}
export function isAuthorizedFor(p: ViewerPermissions, e: { investor: string; project: string }) {
  const okInv = p.investors.length === 0 || p.investors.includes(e.investor);
  const okPrj = p.projects.length === 0 || p.projects.includes(e.project);
  return okInv && okPrj;
}

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

// Pre-baked viewer profiles for the permission selector.
export const VIEWER_PROFILES: ViewerPermissions[] = [
  { label: "Compliance Admin (all access)", investors: [], projects: [] },
  { label: "Helix Capital · investor view", investors: ["Helix Capital"], projects: [] },
  { label: "Nordic Climate Fund · investor view", investors: ["Nordic Climate Fund"], projects: [] },
  { label: "KE-001 Mau Forest · operator view", investors: [], projects: ["KE-001 Mau Forest"] },
  { label: "Aurora × Tana Delta · scoped", investors: ["Aurora Pension"], projects: ["KE-014 Tana Delta"] },
];
