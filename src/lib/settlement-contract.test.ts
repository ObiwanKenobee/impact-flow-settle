import { describe, it, expect, beforeEach } from "vitest";
import {
  contract, FX_PAIRS, OUTCOME_CATALOG, INVESTORS, PROJECTS,
  replayBundle, verifyChain, determinismReport, buildSignedBundleProof,
  isAuthorizedFor, keyFingerprint,
  type OutcomeKind,
} from "./settlement-contract";

beforeEach(() => contract.clear());

describe("settlement-contract replay determinism", () => {
  it("replays deterministically across every FX pair", async () => {
    for (const fxPair of FX_PAIRS) {
      const b = await contract.settle({
        investor: INVESTORS[0], project: PROJECTS[0],
        fxPair, amountIn: 50_000, feeBps: 40, kind: "trees",
      });
      const r = replayBundle(b);
      expect(r.deterministic, `replay for ${fxPair}`).toBe(true);
      r.steps.forEach((s) => {
        expect(s.sigMatches).toBe(true);
        expect(s.prevHashMatches).toBe(true);
      });
      expect(verifyChain(b.events).ok).toBe(true);
    }
  });

  it("replays deterministically across every verification template", async () => {
    for (const kind of Object.keys(OUTCOME_CATALOG) as OutcomeKind[]) {
      const b = await contract.settle({
        investor: INVESTORS[1], project: PROJECTS[1],
        fxPair: "EUR/KES", amountIn: 20_000, feeBps: 25, kind,
      });
      const rep = determinismReport(b);
      expect(rep.deterministic, `determinism for ${kind}`).toBe(true);
      expect(rep.rows.every((r) => r.ok)).toBe(true);
      expect(b.outcomeId.startsWith(OUTCOME_CATALOG[kind].symbol)).toBe(true);
      const proof = buildSignedBundleProof(b);
      expect(proof.events).toHaveLength(5);
      expect(proof.verification.ok).toBe(true);
    }
  });

  it("detects tampering: mutating an event breaks the chain", async () => {
    const b = await contract.settle({
      investor: INVESTORS[0], project: PROJECTS[0],
      fxPair: "EUR/KES", amountIn: 10_000, feeBps: 30, kind: "water",
    });
    expect(verifyChain(b.events).ok).toBe(true);
    const tampered = [...b.events];
    tampered[2] = { ...tampered[2], sig: "sig_tampered_0000" };
    expect(verifyChain(tampered).ok).toBe(false);
  });
});

describe("permissions and fingerprints", () => {
  it("scopes events by investor, project and actor", () => {
    const p = { label: "x", investors: ["Helix Capital"], projects: ["KE-001 Mau Forest"], actors: ["Oracle Network"] };
    expect(isAuthorizedFor(p, { investor: "Helix Capital", project: "KE-001 Mau Forest", actor: "Oracle Network" })).toBe(true);
    expect(isAuthorizedFor(p, { investor: "Aurora Pension", project: "KE-001 Mau Forest", actor: "Oracle Network" })).toBe(false);
    expect(isAuthorizedFor(p, { investor: "Helix Capital", project: "KE-001 Mau Forest", actor: "FX Engine" })).toBe(false);
  });

  it("produces stable signer fingerprints", () => {
    const fp1 = keyFingerprint("FX Engine");
    const fp2 = keyFingerprint("FX Engine");
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9A-F]{4}:[0-9A-F]{4}$/);
    expect(keyFingerprint("FX Engine")).not.toBe(keyFingerprint("Oracle Network"));
  });
});
