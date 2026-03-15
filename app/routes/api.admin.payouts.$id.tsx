import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";

const VALID_PAYOUT_STATUSES = new Set(["pending", "calculated", "sent", "confirmed"]);

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Payout ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const existing = await prisma.payoutTracking.findUnique({ where: { id } });
    if (!existing) {
      return json({ error: "Payout record not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.payoutStatus !== undefined) {
      if (!VALID_PAYOUT_STATUSES.has(body.payoutStatus)) {
        return json({ error: `Invalid payout status. Must be one of: ${[...VALID_PAYOUT_STATUSES].join(", ")}` }, { status: 400 });
      }
      updates.payoutStatus = body.payoutStatus;
    }

    if (body.payoutReference !== undefined) {
      updates.payoutReference = body.payoutReference;
    }

    if (body.payoutMethod !== undefined) {
      updates.payoutMethod = body.payoutMethod;
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "No valid fields to update" }, { status: 400 });
    }

    const payout = await prisma.payoutTracking.update({
      where: { id },
      data: updates,
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "payout.updated",
      objectType: "payout",
      objectId: id,
      details: { updatedFields: Object.keys(updates) },
    });

    return json({ success: true, payout });
  } catch (error) {
    console.error("Update payout error:", error);
    const message = error instanceof Error ? error.message : "Failed to update payout";
    return json({ error: message }, { status: 500 });
  }
}
