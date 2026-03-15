// POST /api/me/offerings/:id/resume — resume a paused offering

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await requireTeacherAuth(request);
  const offeringId = params.id!;

  const offering = await prisma.offering.findFirst({
    where: { id: offeringId, facultyId: auth.facultyId },
  });

  if (!offering) {
    return json({ error: "Not found" }, { status: 404 });
  }

  if (offering.status !== "paused") {
    return json(
      { error: "Only paused offerings can be resumed" },
      { status: 400 },
    );
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

  return json({ success: true });
}
