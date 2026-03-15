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
    return json({ error: "Faculty ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return json({ error: "Suspension reason is required" }, { status: 400 });
    }

    const faculty = await prisma.faculty.findUnique({
      where: { id },
      include: { offerings: { where: { status: "live" } } },
    });

    if (!faculty) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    // Suspend faculty
    await prisma.faculty.update({
      where: { id },
      data: { status: "suspended", profilePublished: false },
    });

    // Pause all live offerings (set to DRAFT in Shopify)
    const pauseResults: Array<{ offeringId: string; success: boolean; error?: string }> = [];
    for (const offering of faculty.offerings) {
      await prisma.offering.update({
        where: { id: offering.id },
        data: { status: "suspended" },
      });

      const syncResult = await syncOfferingStatus(offering.id, "DRAFT", admin);
      pauseResults.push({
        offeringId: offering.id,
        success: syncResult.success,
        error: syncResult.error,
      });
    }

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "faculty.suspended",
      objectType: "faculty",
      objectId: id,
      details: { reason: reason.trim(), offeringsPaused: faculty.offerings.length },
    });

    return json({ success: true, offeringsPaused: pauseResults });
  } catch (error) {
    console.error("Suspend faculty error:", error);
    const message = error instanceof Error ? error.message : "Failed to suspend faculty";
    return json({ error: message }, { status: 500 });
  }
}
