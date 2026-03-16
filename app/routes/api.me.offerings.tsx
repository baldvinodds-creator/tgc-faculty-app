// Teacher offering endpoints
// GET  /api/me/offerings — list my offerings
// POST /api/me/offerings — create new offering (draft)

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  try {
    const auth = await requireTeacherAuth(request);

    const offeringsBase = await prisma.offering.findMany({
      where: { facultyId: auth.facultyId },
      orderBy: { updatedAt: "desc" },
      include: {
        edits: { where: { status: "pending_approval" } },
      },
    });

    // Attach admin comments visible to teacher for each offering
    const offeringIds = offeringsBase.map((o) => o.id);
    const comments = offeringIds.length > 0
      ? await prisma.adminComment.findMany({
          where: { objectType: "offering", objectId: { in: offeringIds }, visibleToTeacher: true },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const commentMap = new Map<string, typeof comments>();
    for (const c of comments) {
      if (!commentMap.has(c.objectId)) {
        commentMap.set(c.objectId, []);
      }
      commentMap.get(c.objectId)!.push(c);
    }

    const offerings = offeringsBase.map((o) => ({
      ...o,
      adminComments: commentMap.get(o.id) || [],
    }));

    return withCors(request, json({ offerings }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Load offerings error:", error);
    return withCors(request, json({ error: "Failed to load offerings" }, { status: 500 }));
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
    const auth = await requireTeacherAuth(request);
    const body = await request.json();

    const offering = await prisma.offering.create({
      data: {
        facultyId: auth.facultyId,
        offeringType: body.offeringType || "private_lesson",
        status: "draft",
        title: body.title || null,
        description: body.description || null,
        topic: body.topic || null,
        level: body.level || null,
        ageGroups: body.ageGroups || [],
        format: body.format || null,
        durationMinutes: body.durationMinutes || null,
        price: body.price || 0,
        currency: body.currency || "USD",
        capacity: body.capacity || null,
        prerequisites: body.prerequisites || null,
        recordingAllowed: body.recordingAllowed || null,
        replayAllowed: body.replayAllowed || null,
        materialsRequired: body.materialsRequired || null,
        oneTime: body.oneTime || false,
        recurringRule: body.recurringRule || null,
        proposedStartDate: body.proposedStartDate ? new Date(body.proposedStartDate) : null,
        proposedEndDate: body.proposedEndDate ? new Date(body.proposedEndDate) : null,
        proposedSchedule: body.proposedSchedule || null,
        seriesLength: body.seriesLength || null,
        termName: body.termName || null,
        syllabus: body.syllabus || null,
        applicationRequired: body.applicationRequired || false,
        performerSeats: body.performerSeats || null,
        observerSeats: body.observerSeats || null,
        eventType: body.eventType || null,
        durationsOffered: body.durationsOffered || null,
      },
    });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "offering.created",
      objectType: "offering",
      objectId: offering.id,
    });

    return withCors(request, json({ offering }, { status: 201 }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Create offering error:", error);
    return withCors(request, json({ error: "Failed to create offering" }, { status: 500 }));
  }
}
