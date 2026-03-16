// POST /api/me/offerings/:id/resume — resume a paused offering

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

    if (offering.status !== "paused") {
      return withCors(request, json(
        { error: "Only paused offerings can be resumed" },
        { status: 400 },
      ));
    }

    // Update local status
    await prisma.offering.update({
      where: { id: offeringId },
      data: { status: "live" },
    });

    // Create sync record so admin dashboard can push ACTIVE status to Shopify
    const existingSync = await prisma.syncShopify.findFirst({
      where: { objectId: offeringId, objectType: "offering_product" },
    });

    if (existingSync) {
      await prisma.syncShopify.update({
        where: { id: existingSync.id },
        data: {
          syncStatus: "needs_update",
          lastError: "Teacher resumed offering — product should be set to ACTIVE",
        },
      });
    } else {
      await prisma.syncShopify.create({
        data: {
          objectType: "offering_product",
          objectId: offeringId,
          shopifyObjectType: "product",
          syncStatus: "needs_update",
          lastError: "Teacher resumed offering — product should be set to ACTIVE",
        },
      });
    }

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "offering.resumed",
      objectType: "offering",
      objectId: offeringId,
    });

    return withCors(request, json({ success: true }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Resume offering error:", error);
    return withCors(request, json({ error: "Failed to resume offering" }, { status: 500 }));
  }
}
