/**
 * Checkout webhook.
 *
 * Lives under /api/public/* so it bypasses auth on published deployments
 * — that's the prefix external payment providers will POST to. Verifies
 * a shared-secret header, marks the purchase row paid, and returns the
 * tier so the success page can provision client-side access.
 *
 * The mock-checkout success page calls this same endpoint; a real Stripe
 * webhook would post the same {purchaseId, providerRef} shape after
 * checkout.session.completed and the rest of the flow is identical.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timingSafeEqual } from "crypto";

const Body = z.object({
  purchaseId: z.string().uuid(),
  providerRef: z.string().max(255).optional(),
  status: z.enum(["paid", "failed"]).default("paid"),
});

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/webhooks/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-webhook-secret") ?? "";
        const expected = process.env.CHECKOUT_WEBHOOK_SECRET ?? "dev-secret-rotate-me";
        if (!safeEqual(provided, expected)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch (e) {
          return new Response(`Bad request: ${(e as Error).message}`, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row, error } = await supabaseAdmin
          .from("purchases")
          .update({
            status: parsed.status,
            provider_ref: parsed.providerRef ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.purchaseId)
          .select("id, tier, cycle, email, status")
          .single();

        if (error || !row) {
          return new Response(`Purchase not found: ${error?.message ?? ""}`, { status: 404 });
        }

        return Response.json({ ok: true, purchase: row });
      },
    },
  },
});
