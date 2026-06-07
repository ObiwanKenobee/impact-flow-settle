/**
 * Mock checkout server fn.
 *
 * Records a pending purchase row in Lovable Cloud, returns a checkout URL
 * pointing at our own success page. A real Stripe / Paddle integration
 * would instead create a hosted checkout session and return its URL — the
 * /api/public/webhooks/checkout route already accepts the same payload
 * shape and provisions access on payment, so swapping providers is a
 * one-file change.
 *
 * Built-in Lovable Payments are not available for sellers in KE, so this
 * is the path the project ships with today.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TIER_PRICES = {
  Operator:      { monthly: 120000, annual: 1150000 },
  Institutional: { monthly: 490000, annual: 4700000 },
  Sovereign:     { monthly: 1850000, annual: 17800000 },
} as const;

const CheckoutInput = z.object({
  tier: z.enum(["Operator", "Institutional", "Sovereign"]),
  cycle: z.enum(["monthly", "annual"]),
  email: z.string().email().max(255),
});

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CheckoutInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const amount_cents = TIER_PRICES[data.tier][data.cycle];

    const { data: row, error } = await supabaseAdmin
      .from("purchases")
      .insert({
        email: data.email,
        tier: data.tier,
        cycle: data.cycle,
        amount_cents,
        currency: "EUR",
        provider: "mock",
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !row) throw new Error(error?.message ?? "Failed to create checkout");

    return {
      purchaseId: row.id as string,
      checkoutUrl: `/checkout/success?purchase_id=${row.id}`,
      amount_cents,
    };
  });
