import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";
import { calculateProfileCompleteness } from "../lib/workflows.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Faculty ID is required" }, { status: 400 });
  }

  try {
    const facultyBase = await prisma.faculty.findUnique({
      where: { id },
      include: {
        application: true,
        offerings: {
          orderBy: { createdAt: "desc" },
        },
        availability: true,
        tech: true,
        media: { orderBy: { sortOrder: "asc" } },
        consents: { orderBy: { acceptedAt: "desc" } },
        profileEdits: { orderBy: { submittedAt: "desc" } },
        payoutTracking: { orderBy: { periodStart: "desc" } },
      },
    });

    if (!facultyBase) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    const [approvals, adminComments, syncShopify, syncAppointo] = await Promise.all([
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
      prisma.syncAppointo.findMany({
        where: { objectId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Attach offering-level sync records
    const offeringIds = facultyBase.offerings.map((o) => o.id);
    const offeringSyncs = offeringIds.length > 0
      ? await prisma.syncShopify.findMany({
          where: { objectId: { in: offeringIds }, objectType: "offering_product" },
          orderBy: { updatedAt: "desc" },
        })
      : [];

    const offeringSyncMap = new Map<string, typeof offeringSyncs>();
    for (const s of offeringSyncs) {
      const arr = offeringSyncMap.get(s.objectId) || [];
      arr.push(s);
      offeringSyncMap.set(s.objectId, arr);
    }

    const offerings = facultyBase.offerings.map((o) => ({
      ...o,
      syncShopify: (offeringSyncMap.get(o.id) || []).slice(0, 1),
    }));

    const faculty = { ...facultyBase, offerings, approvals, adminComments, syncShopify, syncAppointo };

    return json({ faculty });
  } catch (error) {
    console.error("Faculty detail error:", error);
    return json({ error: "Failed to load faculty" }, { status: 500 });
  }
}

// Allowlist of fields an admin can edit directly
const EDITABLE_FIELDS = new Set([
  "fullName",
  "publicName",
  "phone",
  "country",
  "city",
  "timezone",
  "teachingLanguages",
  "shortBio",
  "longBio",
  "credentials",
  "institutions",
  "awards",
  "specialties",
  "primaryInstrument",
  "division",
  "yearsExperience",
  "headshotUrl",
  "websiteUrl",
  "socialInstagram",
  "socialYoutube",
  "socialLinkedin",
  "socialTwitter",
  "socialOther",
  "introVideoUrl",
  "zoomLink",
  "acceptingStudents",
  "featured",
]);

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Faculty ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Filter to only editable fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (EDITABLE_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Apply updates
    const faculty = await prisma.faculty.update({
      where: { id },
      data: updates,
    });

    // Recalculate completeness
    const completeness = calculateProfileCompleteness(faculty);
    await prisma.faculty.update({
      where: { id },
      data: { profileCompleteness: completeness },
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "faculty.admin_edit",
      objectType: "faculty",
      objectId: id,
      details: { updatedFields: Object.keys(updates) },
    });

    return json({ success: true, faculty: { ...faculty, profileCompleteness: completeness } });
  } catch (error) {
    console.error("Update faculty error:", error);
    const message = error instanceof Error ? error.message : "Failed to update faculty";
    return json({ error: message }, { status: 500 });
  }
}
