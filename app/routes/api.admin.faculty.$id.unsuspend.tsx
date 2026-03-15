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
    const faculty = await prisma.faculty.findUnique({
      where: { id },
      include: { offerings: { where: { status: "suspended" } } },
    });

    if (!faculty) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    if (faculty.status !== "suspended") {
      return json({ error: "Faculty is not currently suspended" }, { status: 400 });
    }

    // Restore faculty to active
    await prisma.faculty.update({
      where: { id },
      data: { status: "active" },
    });

    // Resume suspended offerings
    const resumeResults: Array<{ offeringId: string; success: boolean; error?: string }> = [];
    for (const offering of faculty.offerings) {
      await prisma.offering.update({
        where: { id: offering.id },
        data: { status: "live" },
      });

      const syncResult = await syncOfferingStatus(offering.id, "ACTIVE", admin);
      resumeResults.push({
        offeringId: offering.id,
        success: syncResult.success,
        error: syncResult.error,
      });
    }

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "faculty.unsuspended",
      objectType: "faculty",
      objectId: id,
      details: { offeringsResumed: faculty.offerings.length },
    });

    return json({ success: true, offeringsResumed: resumeResults });
  } catch (error) {
    console.error("Unsuspend faculty error:", error);
    const message = error instanceof Error ? error.message : "Failed to unsuspend faculty";
    return json({ error: message }, { status: 500 });
  }
}
