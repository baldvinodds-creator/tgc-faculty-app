// POST /api/me/offerings/:id/pause — pause a live offering

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

  const auth = await requireTeacherAuth(request);
  const offeringId = params.id!;

  const offering = await prisma.offering.findFirst({
    where: { id: offeringId, facultyId: auth.facultyId },
  });

  if (!offering) {
    return withCors(request, json({ error: "Not found" }, { status: 404 }));
  }

  if (offering.status !== "live") {
    return withCors(request, json(
      { error: "Only live offerings can be paused" },
      { status: 400 },
    ));
  }

  // Update local status
  await prisma.offering.update({
    where: { id: offeringId },
    data: { status: "paused" },
  });

  // Create sync record so admin dashboard can push DRAFT status to Shopify
  const existingSync = await prisma.syncShopify.findFirst({
    where: { objectId: offeringId, objectType: "offering_product" },
  });

  if (existingSync) {
    await prisma.syncShopify.update({
      where: { id: existingSync.id },
      data: {
        syncStatus: "needs_update",
        lastError: "Teacher paused offering — product should be set to DRAFT",
      },
    });
  } else {
    await prisma.syncShopify.create({
      data: {
        objectType: "offering_product",
        objectId: offeringId,
        shopifyObjectType: "product",
        syncStatus: "needs_update",
        lastError: "Teacher paused offering — product should be set to DRAFT",
      },
    });
  }

  await logAudit({
    actorType: "teacher",
    actorId: auth.facultyId,
    action: "offering.paused",
    objectType: "offering",
    objectId: offeringId,
  });

  return withCors(request, json({ success: true }));
}
