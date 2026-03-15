import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";
import { syncOfferingStatus } from "../lib/provisioning.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Offering ID is required" }, { status: 400 });
  }

  try {
    const offering = await prisma.offering.findUnique({ where: { id } });
    if (!offering) {
      return json({ error: "Offering not found" }, { status: 404 });
    }

    // Set offering status to suspended
    await prisma.offering.update({
      where: { id },
      data: { status: "suspended" },
    });

    // Sync product to DRAFT in Shopify
    const syncResult = await syncOfferingStatus(id, "DRAFT", admin);

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "offering.suspended",
      objectType: "offering",
      objectId: id,
    });

    return json({ success: true, sync: syncResult });
  } catch (error) {
    console.error("Suspend offering error:", error);
    const message = error instanceof Error ? error.message : "Failed to suspend offering";
    return json({ error: message }, { status: 500 });
  }
}
