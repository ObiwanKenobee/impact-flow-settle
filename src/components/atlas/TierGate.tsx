import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  useEntitlement,
  hasFeature,
  minimumTierFor,
  type FeatureKey,
} from "@/lib/entitlements";

interface TierGateProps {
  feature: FeatureKey;
  label: string;
  children: ReactNode;
}

/**
 * Renders children only when the current entitlement covers `feature`.
 * Otherwise shows a locked overlay pointing to the minimum-required tier.
 */
export function TierGate({ feature, label, children }: TierGateProps) {
  const ent = useEntitlement();
  if (hasFeature(ent, feature)) return <>{children}</>;
  const required = minimumTierFor(feature);
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="border border-accent bg-card max-w-md w-full p-8 text-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
            {required}+ tier required
          </span>
          <h3 className="font-display font-bold text-2xl mt-3">{label} is locked</h3>
          <p className="font-mono text-[11px] text-muted-foreground mt-3 leading-relaxed">
            {ent
              ? `Your ${ent.tier} entitlement does not include this panel. Upgrade to ${required} to unlock.`
              : `Subscribe to the ${required} tier or higher to unlock this panel. Access is provisioned immediately after checkout.`}
          </p>
          <Link
            to="/pricing"
            className="inline-block mt-6 px-6 py-3 bg-accent text-accent-foreground font-mono text-[11px] uppercase tracking-widest"
          >
            View pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
