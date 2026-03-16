// POST /api/me/offerings/:id/cancel — cancel a pending submission

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;
  return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
    const auth = await requireTeacherAuth(request);
    const offeringId = params.id!;

    const offering = await prisma.offering.findFirst({
      where: { id: offeringId, facultyId: auth.facultyId },
    });

    if (!offering) {
      return withCors(request, json({ error: "Not found" }, { status: 404 }));
    }

    if (offering.status !== "pending_approval") {
      return withCors(request, json(
        { error: "Only pending offerings can be cancelled" },
        { status: 400 },
      ));
    }

    // Revert offering to draft
    await prisma.offering.update({
      where: { id: offeringId },
      data: { status: "draft" },
    });

    // Cancel any pending approval records for this offering
    await prisma.approval.updateMany({
      where: {
        objectId: offeringId,
        objectType: "offering",
        status: "pending",
      },
      data: {
        status: "cancelled",
        resolvedAt: new Date(),
      },
    });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "offering.submission_cancelled",
      objectType: "offering",
      objectId: offeringId,
    });

    return withCors(request, json({ success: true }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Cancel offering error:", error);
    return withCors(request, json({ error: "Failed to cancel submission" }, { status: 500 }));
  }
}
