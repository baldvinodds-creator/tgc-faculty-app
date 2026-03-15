import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Offering ID is required" }, { status: 400 });
  }

  try {
    const [offeringBase, approvals, adminComments, syncShopify] = await Promise.all([
      prisma.offering.findUnique({
        where: { id },
        include: {
          faculty: {
            select: {
              id: true,
              fullName: true,
              publicName: true,
              email: true,
              division: true,
              primaryInstrument: true,
            },
          },
          edits: { orderBy: { submittedAt: "desc" } },
        },
      }),
      prisma.approval.findMany({
        where: { objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.adminComment.findMany({
        where: { objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.syncShopify.findMany({
        where: { objectId: id },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    if (!offeringBase) {
      return json({ error: "Offering not found" }, { status: 404 });
    }

    const offering = { ...offeringBase, approvals, adminComments, syncShopify };

    return json({ offering });
  } catch (error) {
    console.error("Offering detail error:", error);
    return json({ error: "Failed to load offering" }, { status: 500 });
  }
}

const EDITABLE_FIELDS = new Set([
  "title",
  "description",
  "topic",
  "level",
  "ageGroups",
  "format",
  "durationMinutes",
  "price",
  "currency",
  "capacity",
  "acceptingStudents",
  "prerequisites",
  "recordingAllowed",
  "replayAllowed",
  "materialsRequired",
  "oneTime",
  "recurringRule",
  "proposedStartDate",
  "proposedEndDate",
  "proposedSchedule",
  "seriesLength",
  "termName",
  "syllabus",
  "applicationRequired",
  "performerSeats",
  "observerSeats",
  "eventType",
  "durationsOffered",
]);

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Offering ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (EDITABLE_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "No valid fields to update" }, { status: 400 });
    }

    const offering = await prisma.offering.update({
      where: { id },
      data: updates,
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "offering.admin_edit",
      objectType: "offering",
      objectId: id,
      details: { updatedFields: Object.keys(updates) },
    });

    return json({ success: true, offering });
  } catch (error) {
    console.error("Update offering error:", error);
    const message = error instanceof Error ? error.message : "Failed to update offering";
    return json({ error: message }, { status: 500 });
  }
}
