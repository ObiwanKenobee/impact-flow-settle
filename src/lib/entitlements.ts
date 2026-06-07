/**
 * Client-side entitlement store.
 *
 * Persisted in localStorage so a successful checkout immediately unlocks
 * tier-gated panels without requiring login. A real deployment would
 * fetch entitlements server-side from the `purchases` table keyed off the
 * authenticated user; the shape here matches that future contract.
 */
import { useEffect, useState } from "react";

export type Tier = "Operator" | "Institutional" | "Sovereign";

export interface Entitlement {
  tier: Tier;
  email: string;
  purchaseId: string;
  cycle: "monthly" | "annual";
  grantedAt: string;
}

const KEY = "atlas.sanctum.entitlement";

// Tier → unlocked feature flags
export const TIER_FEATURES: Record<Tier, {
  liveEngine: boolean;
  replay: boolean;
  admin: boolean;
}> = {
  Operator:     { liveEngine: true,  replay: false, admin: false },
  Institutional:{ liveEngine: true,  replay: true,  admin: false },
  Sovereign:    { liveEngine: true,  replay: true,  admin: true  },
};

export type FeatureKey = keyof (typeof TIER_FEATURES)["Operator"];

export function readEntitlement(): Entitlement | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entitlement) : null;
  } catch {
    return null;
  }
}

export function writeEntitlement(e: Entitlement) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(e));
  window.dispatchEvent(new Event("atlas:entitlement"));
}

export function clearEntitlement() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("atlas:entitlement"));
}

export function useEntitlement() {
  const [ent, setEnt] = useState<Entitlement | null>(null);
  useEffect(() => {
    setEnt(readEntitlement());
    const refresh = () => setEnt(readEntitlement());
    window.addEventListener("atlas:entitlement", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("atlas:entitlement", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return ent;
}

export function hasFeature(ent: Entitlement | null, feature: FeatureKey): boolean {
  if (!ent) return false;
  return TIER_FEATURES[ent.tier][feature];
}

export function minimumTierFor(feature: FeatureKey): Tier {
  if (TIER_FEATURES.Operator[feature]) return "Operator";
  if (TIER_FEATURES.Institutional[feature]) return "Institutional";
  return "Sovereign";
}
